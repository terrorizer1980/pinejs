require = require('requirejs')

require({
	config: {
		has: {
			ENV_NODEJS              :  true,
			SBVR_SERVER_ENABLED     :  true,
			EDITOR_SERVER_ENABLED   :  true,
			BROWSER_SERVER_ENABLED  :  false,
			USE_MYSQL               :  true,
			USE_POSTGRES            :  false,
			DEV                     :  true
		}
	},
	paths: {
		//Developing & building tools
		'cs'              :  '../../tools/requirejs-plugins/cs',
		'ometa'           :  '../../tools/requirejs-plugins/ometa',
		'text'            :  '../../tools/requirejs-plugins/text',
		'coffee-script'   :  '../../tools/coffee-script',
		'has'             :  '../../tools/has',

		//Libraries
		'ometa-compiler'  :  '../../external/ometa-js/lib/ometajs/ometa/parsers',
		'ometa-core'      :  '../../external/ometa-js/lib/ometajs/core',
		'OMeta'           :  '../../external/ometa-js/lib/ometajs/core',
		'sbvr-parser'     :  '../../common/sbvr-parser',
		'utils'           :  '../../common/utils',
		'Prettify'        :  '../../common/Prettify',
		'inflection'      :  '../../external/inflection/inflection',
	},
	shim: {
		'ometa-compiler': {
			deps: ['ometa-core']
		}
	},
	uglify: {
		make_seqs: false,
		ascii_only: true,
		beautify: true,
		max_line_length: 1000,
		no_mangle: true
	},
}, ['cs!server-glue/server']);
