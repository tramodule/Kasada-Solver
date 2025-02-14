import chalk from 'chalk';

export class Logger {

    constructor(name) {
        this.name = name;
    }

    // Returns the current time formatted as HH:MM:SS
    static getTime() {
        const now = new Date();
        // Format as HH:MM:SS
        return now.toTimeString().split(' ')[0];
    }


    static log(levelColor, levelName, messageColor, message) {
        const formattedMessage =
            `${chalk.magenta(`[TRAMODULE]`)} ` +
            `${chalk.white(`[${this.getTime()}]`)} ` +
            `${levelColor(levelName)} -> ${messageColor(message)}`;
        console.log(formattedMessage);
    }

    static info(message) {
        // The message is wrapped with additional formatting
        this.log(chalk.yellow, "[Info]", chalk.blueBright, chalk.yellow(`[ ${message} ]`));
    }

    static success(message) {
        this.log(chalk.green, "[Success]", chalk.blueBright, chalk.green(`[ ${message} ]`));
    }

    static error(message) {
        this.log(chalk.red, "[Error]", chalk.redBright, chalk.red(`[ ${message} ]`));
    }

    static warn(message) {
        this.log(chalk.magenta, "[Warn]", chalk.yellowBright, chalk.magenta(`[ ${message} ]`));
    }
}

