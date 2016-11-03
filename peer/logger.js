var logger = require('winston');
logger.setLevels({ debug: 3, info: 2, warn: 1, error: 0});
logger.addColors({ debug: 'green', info: 'cyan', warn: 'yellow', error: 'red' });
logger.remove(logger.transports.Console);
logger.add(logger.transports.Console, { level: 'debug', colorize: true });


module.exports = logger;