fs = require('fs')
vm = require('vm')
load = (filePath) ->
	vm.runInThisContext(fs.readFileSync(filePath, 'utf8'), __filename)

load(__dirname + '/../../../external/ometa-js/lib.js')
load(__dirname + '/../../../external/ometa-js/ometa-base.js')
load(__dirname + '/../../../external/ometa-js/parser.js')
load(__dirname + '/../../../external/ometa-js/bs-js-compiler.js')
load(__dirname + '/../../../external/ometa-js/bs-ometa-compiler.js')
load(__dirname + '/../../../external/ometa-js/bs-ometa-optimizer.js')
load(__dirname + '/../../../external/ometa-js/bs-ometa-js-compiler.js')
load(__dirname + '/../../../external/beautify/beautify.js')

translationError = (m, i) ->
	console.log('Translation error - please report this!')
	throw fail
parsingError = (ometa) ->
	(m, i) ->
		start = Math.max(0, i - 20)
		console.log "Error around: " + ometa.substring(start, Math.min(ometa.length, start + 40))
		console.log "Error around: " + ometa.substring(i - 2, Math.min(ometa.length, i + 2))
		throw m

compileOmeta = (ometa, pretty, desc = 'OMeta') ->
	try
		console.log('Parsing: ' + desc)
		tree = BSOMetaJSParser.matchAll(ometa, 'topLevel', undefined, parsingError(ometa))
		console.log('Compiling: ' + desc)
		js = BSOMetaJSTranslator.match(tree, 'trans', undefined, translationError)
		if pretty == true
			console.log('Beautifying: ' + desc)
			js = js_beautify(js)
		return js
	catch e
		return false

compileOmetaFile = (ometaFilePath, jsFilePath, pretty) ->
	console.log('Reading: ' + ometaFilePath)
	fs.readFile(ometaFilePath, 'utf8', do (ometaFilePath) ->
		(err, data) ->
			if err
				console.log(err)
			else
				ometa = data.replace(/\r\n/g, '\n')
				js = compileOmeta(ometa, pretty, ometaFilePath)
				if js != false
					console.log('Writing: ' + ometaFilePath)
					fs.writeFile(jsFilePath, js)
	)


if process.argv[1] == __filename
	nopt = require('nopt')
	knownOpts =
		'pretty': Boolean
		'watch': Boolean
	shortHands = 
		'-p': ['--pretty']
		'-w': ['--watch']
	parsed = nopt(knownOpts, shortHands, process.argv, 2)
	doCompile = (filePath) ->
		compileOmetaFile(filePath, filePath.substring(0, filePath.lastIndexOf('.')) + '.js', parsed.pretty)
	for filePath in parsed.argv.remain
		if parsed.watch
			fsWatcher = fs.watch(filePath)
			fsWatcher.on('change', (event, filename) ->
				doCompile(filePath)
			)
		else
			doCompile(filePath)
		


exports?.compileOmetaFile = compileOmetaFile
exports?.compileOmeta = compileOmeta