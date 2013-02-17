define([
	'backbone'
	'codemirror'
], (Backbone, CodeMirror) ->
	Backbone.View.extend(
		events:
			"click #bidb": "importDB"
			"click #bedb": "exportDB"

		setTitle: (title) ->
			@options.title.text(title)

		render: ->
			this.setTitle('Import/Export DB')
			
			html = """
				<div id="bidb" class="btn btn-small btn-primary">Import DB</div>
				<div id="bedb" class="btn btn-small">Export DB</div><br />"""

			textarea = $('<textarea />')
			@$el.html(html).append(textarea)
			
			@editor = CodeMirror.fromTextArea(textarea.get(0),
				mode:
					name: 'text/x-plsql'
				lineWrapping: true
				highlightMargin: 0
			)

			$(window).resize(=>
				@editor.setSize(@$el.width(), @$el.height() - 26)
			).resize()

		importDB: ->
			serverRequest('PUT', '/importdb/', {}, @editor.getValue())
		exportDB: ->
			serverRequest('GET', '/exportdb/', {}, '', (statusCode, result) =>
				console.error(statusCode, result)
				@editor.setValue(result)
			)
	)
)