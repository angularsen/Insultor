module.exports = function(config) {
	config.set({
			frameworks: ['jasmine', 'karma-typescript'],
			files: [
					{ pattern: 'src/**/*.ts' }, // *.tsx for React Jsx
			],
			preprocessors: {
					'**/*.ts': ['karma-typescript'], // *.tsx for React Jsx
			},
			karmaTypescriptConfig: {
				compilerOptions: {
          target: "es5", // test coverage does not support es2015+
					sourceMap: true,
					lib: [
						"dom",
						"es2017"
					],
				},
				coverageOptions: {
						exclude: [/\.(d|spec)\.ts$/i, /.*node_modules.*/]
				},
				tsconfig: "./tsconfig.json",
			},
			reporters: ['progress', 'karma-typescript'],
			browsers: ['ChromeDebugging'/*'Chrome'*//*, 'PhantomJS'*/],
			customLaunchers: {
				ChromeDebugging: {
					base: 'Chrome',
					flags: [ '--remote-debugging-port=9333' ]
				}
			}
	});
};