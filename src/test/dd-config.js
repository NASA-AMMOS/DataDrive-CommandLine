const chai = require("chai");
const expect = chai.expect;
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

describe("Config Command", function () {
  const basePath = path.join(process.env.HOME, ".datadrive", "datadrive.json");
  const backupPath = path.join(
    process.env.HOME,
    ".datadrive",
    "datadrive-backup.json",
  );

  beforeEach(function () {
    fs.copyFileSync(basePath, backupPath);
  });

  afterEach(function () {
    fs.copyFileSync(backupPath, basePath);
    fs.unlinkSync(backupPath);
  });

  it("should create an output file with the correct contents", function () {
    // Define the expected output file path and content

    const expectedContent = JSON.stringify({
      pepHost: "data.dev.m20.jpl.nasa.gov",
      datadriveHost: "dd-dev.dev.m20.jpl.nasa.gov/ddmw",
      logdir: "logs",
    });

    // Call your function with the given command
    execSync(
      "node ddrv.js config -d dd-dev.dev.m20.jpl.nasa.gov/ddmw -p data.dev.m20.jpl.nasa.gov -l logs",
    );

    const configFileOut = fs.readFileSync(basePath, "utf-8");
    expect(configFileOut).to.equal(expectedContent);
  });
});
