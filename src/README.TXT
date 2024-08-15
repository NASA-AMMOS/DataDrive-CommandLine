This is the DataDrive Command-Line Interface (CLI) bundle.

It works with OCS and with AOCS as the back-end system, using CSSO or CAM authentication systems
(for OCS and AOCS respectively).

Once installed, you must configure DataDrive by running "ddrv config". Use "ddrv config --help" to see 
the available options, including the default values.

The DataDrive CLI extends functionality of the OCS Command line tools by adding support for
the following commands:
1) subscribe: Package-based subscriptions, where files added to OCS are automatically downloaded to the
   local system;
2) publish: Package-based publish sessions, where files added to a local directory can be automatically
   push to a remote OCS package.

For help information, use "ddrv [command] --help".

Additional help is available in the README at: 
https://github.com/NASA-AMMOS/DataDrive-CommandLine

You can also learn more about the OCS CLI by visiting:
https://github.jpl.nasa.gov/M2020-CS3/m2020-data-lake/wiki/The-OCS-Command-Line-Interface-%28CLI%29

   
