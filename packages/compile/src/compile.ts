const debug = require("debug")("external-compile");
const { exec } = require("child_process");
const resolve = require("path").resolve;
const { callbackify, promisify } = require("util");
import { colors } from "./colors";
const chalk = require("chalk");

/**
 * buffer a line of data, yielding each full line
 *
 * returned generator alternates between two states:
 * 1. reset
 * 2. read/write
 *
 * usage: d d
 *
 *   let gen = bufferLines();
 *
 *   // first reset
 *   gen.next(); // reset
 *
 *   // pass string data with zero or more new lines
 *   // or pass `null` to signal EOF
 *   let { value, done } = gen.next(data);
 *
 *   // if done, value possibly contains string value with unterminated output
 *   // otherwise, value contains any/all complete lines
 */
function* bufferLines() {
  let buffer = [];

  while (true) {
    // read input string or null as eof
    const input = yield;

    // eof returns buffer
    if (input == null) {
      const unterminated = buffer.join("");

      return unterminated ? [`${unterminated}%`] : [];
    }

    // split lines
    // last element is always partial line
    const data = input.split("\n");

    // add first element to buffer
    let [first] = data.slice(0);
    buffer.push(first);

    if (data.length > 1) {
      // split off partial line to save as new buffer
      const [last] = data.slice(-1);
      const [...middle] = data.slice(1, -1);

      // use buffer as first element (now complete line)
      // and yield allls complete lines
      const lines = [buffer.join(""), ...middle];
      yield lines;

      // reset buffer
      buffer = [last];
    } else {
      // nothing to see yet
      yield [];
    }
  }
}

/**
 * run a command, forwarding data to arbitrary logger.
 * invokes callback when process exits, error on nonzero exit code.
 */
export const runCommand = promisify(function(
  command: any,
  options: { cwd: any; logger: any; input: any; events: any },
  callback: any
) {
  if (options.logger == null) {
    options.logger = console;
  }
  const { cwd, logger, input, events } = options;
  const child = exec(command, { cwd, input });
  let warnings = [];
  let errors = [];

  // wrap buffer generator for easy use
  const buffer = (func: (arg0: any) => void) => {
    const gen = bufferLines();

    return (data: unknown) => {
      gen.next();

      let { value: lines } = gen.next(data);
      for (let line of lines!) {
        func(line);
      }
    };
  };
  const log = buffer(logger.log);
  const warn = buffer(logger.warn);
  child.stderr.on("data", (data: any) => {
    if (data.search("error") >= 0) {
      const errorStr = chalk.red("   " + data.toString());
      errors.push(errorStr);
      warn(errorStr);
    } else if (data.search("warning") >= 0) {
      const warningStr = chalk.yellow("   " + data.toString());
      warnings.push(warningStr);
      log(warningStr);
    } else {
      log(data.toString());
    }
  });

  child.on("close", function(code: string | number) {
    // close streams to flush unterminated lines
    log(null);
    warn(null);

    // If the command didn't exit properly, show the output and throw.
    if (code !== 0) {
      var err = new Error("Unknown exit code: " + code);
      return callback(err);
    }

    callback({ warnings, errors });
  });
});
