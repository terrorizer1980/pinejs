dirTasks = jake.rmutils.dirNamespace()
ometaTasks = jake.rmutils.ometaCompileNamespace(__dirname)
coffeeTasks = jake.rmutils.coffeeCompileNamespace(__dirname)
jake.rmutils.cleanTask()
desc('Compile all of this module')
task('all', dirTasks.concat(ometaTasks, coffeeTasks))