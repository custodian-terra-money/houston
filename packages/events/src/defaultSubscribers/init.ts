const OS = require("os");

export default {
  initialization: function() {
    this.logger = console;
  },
  handlers: {
    "init:start": [
      function() {
        this.logger.log(`${OS.EOL}Starting init...`);
        this.logger.log(`================`);
      },
    ],
    "init:copyingProjectFiles": [
      function({ destinationPath }) {
        this.logger.log(
          `${OS.EOL}> Copying project files to ${destinationPath}`
        );
      },
    ],
    "init:succeed": [
      function() {
        this.logger.log(`${OS.EOL}Init successful, Ready to launch!${OS.EOL}`);
      },
    ],
    "init:fail": [
      function({ error }) {
        this.logger.log(`${OS.EOL}Something went wrong while copying files!`);
        this.logger.log(`${error}${OS.EOL}`);
      },
    ],
  },
};
