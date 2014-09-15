var semver = require('semver');

module.exports = function(text) {
	var buildDir = '.',
		hasConfig = JSON.stringify(this.has, null, '\t'),
		childProcess = require('child_process');
	childProcess.exec('npm list --json', function(err, stdout, stderr) {
		if(err) {
			console.error(err);
			throw err;
		}
		var installedPackages = JSON.parse(stdout).dependencies;
		var dependencies = require(buildDir + '/../../../package.json').dependencies;
		var depMismatch = false;
		for(var packageName in dependencies) {
			if(installedPackages[packageName]) {
				var installedVersion = installedPackages[packageName].version;

				if(!semver.satisfies(installedVersion, dependencies[packageName])) {
					console.error('Installed dependencies for "' + packageName + '" do not match package.json, installed: "' + installedVersion + '", expected: "' + dependencies[packageName] + '", please npm install.')
					depMismatch = true;
				}
			}
			else {
				console.error(packageName + ' is not installed, please npm install.');
				depMismatch = true;
			}
		}
		if(depMismatch) {
			process.exit(1);
		}
		childProcess.exec('git describe --tags', {
			cwd: buildDir
		}, function(err, stdout, stderr) {
			if(err) {
				console.error(err);
				throw err;
			}
			childProcess.exec('git diff --exit-code', {
				cwd: buildDir
			}, function(err) {
				var workingDirChangeSignifier = '';
				if(err) {
					// There are working dir changes.
					workingDirChangeSignifier = '+';
				}
				text = '// Build: ' + stdout.trim() + workingDirChangeSignifier + '\n' +
						'/* has: ' + hasConfig + ' */\n' +
					text;
				require('fs').writeFile(buildDir + '/platform.js', text, function(err) {
					if(err) {
						console.error(err);
						throw err;
					}
				});
			});
		});
	});
};