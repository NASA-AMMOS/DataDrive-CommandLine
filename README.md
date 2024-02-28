# DataDrive-CommandLine
DataDrive Command Line clients

This project will provide command line applications to interface with Datadrive/OCS. The DataDrive command line supplements tools within the OCS suite by providing a way of listening to OCS events without having to interface with AWS.

## Installation
### From Github Release
Please visit https://github.com/NASA-AMMOS/DataDrive-CommandLine/releases to get the latest and past releases. Each zip contains binaries for Linux, Windows and OSX.

### From Source
#### Prerequisites
- NodeJS: tested with v14.15.0, versions newer should also work
#### Steps
- Clone this repository and go to `[cloned_folder]`
- Run `make package`
    - Note: Make sure you have artifactory set as another npm registry by creating or updating `~/.npmrc` file with the following content added or appended.
        - `@gov.nasa.jpl.m2020.cs3:registry=https://cae-artifactory.jpl.nasa.gov:443/artifactory/api/npm/npm-release-local/`
    - Please reference <https://www.jfrog.com/confluence/display/RTF/Npm+Registry> for a more detailed read up. 
- Built binary will be located in `[cloned_folder]/deployment/dist`

## Getting Started
Now that the DataDrive CLI has been installed, please log into CSSO using the CREDSS CLI via the command `credss`. This can be downloaded from the [credss](https://github.jpl.nasa.gov/CS3/credss/releases) Github repository. Installation instructions are also included in link above. Note: Please run `credss` from the extracted folder if you did not put `credss` into your system PATH. 

### Configure CLI
To configure the CLI, please run the following command:
- `./ddrv config -d [datadrive_middleware_hostname] -p [pep_hostname]`
- Ex: `./ddrv config -d dd-dev.dev.m20.jpl.nasa.gov/ddmw -p data.dev.m20.jpl.nasa.gov`
The command above will create a configuration JSON file in `~/.datadrive/datadrive.json`. Note: You should only need to run this once unless `~/.datadrive/datadrive.json` file is deleted.

### Basic Subscriptions
To listen for file new files that have been added in a specific package and download the file to a specified folder. 
- Ex:
    - `./ddrv subscribe -p [ocs_package_name] -o [output_directory_path_here] -r`
        - Note: `-r` flag is to retain the ocs path
        - Note: `--help` flag displays help information
    - Note: Underneath the covers, this CLI uses the web socket API from the DataDrive Middleware, which itself polls a SQS queue that receives update events from OCS's SNS.

### Subscriptions with Wildcard filtering
Similar to **Basic Subscriptions** above, but filter for only files that match a wildcard filter.
- Ex: `./ddrv subscribe -p [ocs_package_name] -o [output_directory_path_here] -r -f [wildcard_filter]`
- `-f` flag should be followed by a wildcard filter. For example, `nick*.txt` will match `nick_09-24-2019.txt` and not `nick_09-24-2019.gif`.
- **Basic Subscriptions** essentially is running the `-f` flag with `*` as its value. 

### Subscriptions with Regex filtering
Similar to **Basic Subscriptions** above, but filter for only files that match a regex filter.
- Ex: `./ddrv subscribe -p [ocs_package_name] -o [output_directory_path_here] -r -x [regex_filter]`
- `-x` flag should be followed by a regex filter. For example, `nick.*\.txt` will match `nick_09-24-2019.txt` and not `nick_09-24-2019.gif`.
- The regex filter uses ElasticSearch's regex syntax and does not take anchor strings indicating beginning `^` or end `$`. Values put into the filter will always be anchored and the regex filter provided must match the entire string. For more information on the regex expression syntax, please visit <https://www.elastic.co/guide/en/elasticsearch/reference/6.4/query-dsl-regexp-query.html#regexp-syntax>.
- The regex filter requires a "/" when matching a path, otherwise it will match the expression against the file basename

### Skip Unchanged
`-S` or `--skip-unchanged`: Only download files that are new or have changed.

Uses the OCS index event field `s3_object_changed` which indicates if associated file is considered changed in S3.
If a user specifies the skip-unchanged flag, then for each OCS file event, the CLI will:

- check if the OCS event indicates that file is unchanged;
- check if local filesystem already contains a file with same name in the output location.
- If both S3 unchanged and local file exists, then OCS file event will be skipped.

Note: Skipping only applies to OCS events. When performing Playback, all files are assumed to be changed, even if they actually weren't.

### Subscriptions with Saved Search
Instead of defining a `ocs_package_name` with the `-p` flag, you can subscribe to a saved search that can be created in the DataDrive UI using the `-s` flag.
- Ex: `./ddrv subscribe -p [saved_search_name] -o [output_directory_path_here] -r`
- Note: The above command uses the `-r` flag which will retain the ocs path.

### Subscriptions with your own script
You can run a single script that will be called for every notification.
- Ex: `./ddrv subscribe -p [ocs_package_name] -o [output_directory_path_here] -r -x [regex_filter] --plugin-path [path_to_script]`
- `--plugin-path` flag's value should be an absolute path to your script.
- Please reference <https://github.jpl.nasa.gov/MIPL/DataDrive-CommandLine/tree/master/src/plugin_examples> for examples scripts that you can take inspiration from.
- You must inherit from `DdPlugin` class and implement `processItem` function.

### Playback events
You can "playback" events that have since happened from a certain date. When "playback" is enabled, the CLI will query OCS for documents (that have not been deleted) since the last saved checkpoint date. 
- `-P` flag is used to denote the use of the playback option.
- The checkpoint date is saved in `YYYY-MM-DDTHH:mm:ss.SSSZZ` format in the `<output_dir>/.datadrive/checkpoint.txt` file in the specified output folder.

## Unit Test
To run unit tests, go to `src/` folder and run the command `npm test`. Note: To avoid confusion, the commands below is for manual testing without packaging files into a single binary.

## Manual Tests
Please note, these test cases are for **developers** performing manual test from the source code. For others that are performing these tests via the published binary, you would start commands below with `ddrv` instead of `node ddrv.js`.
### Test 1 - Subscriptions Only
#### Steps
- Run the command line such as the example below.
    - Ex: `node ddrv.js subscribe -o tmp -p DataDrive-Dev-Congruent-1` or `./ddrv subscribe -o tmp -p DataDrive-Dev-Congruent-1`
- Upload a file into the specified package in the example above "DataDrive-Dev-Congruent-1"
#### Expected Results
- File should be downloaded into the specified folder. In example above, the `tmp` folder.
- A date should be written into the `<output_dir>/.datadrive/checkpoint.txt` file under the specified folder.
    - Ex: `2019-09-08T11:51:28.000-0700`

### Test 2 - Subscriptions and Playback Events
#### Steps
- Run the command line such as the example below.
    - Ex: `node ddrv.js subscribe -o /tmp -p DataDrive-Dev-Congruent-1 -P` or `./ddrv subscribe -o tmp -p DataDrive-Dev-Congruent-1 -P`
#### Expected Results
- Files since the date listed in `<output_dir>/.datadrive/checkpoint.txt` will be downloaded into the specified folder.
- The CLI will now be listening for new files uploaded into the specified package.
- Reference **Subscription Only** for expected results for file subscriptions.

### Test 3 - Playback Events on Deleted File
#### Steps
- Upload files into specified package then delete these files.
- Make sure `<output_dir>/.datadrive/checkpoint.txt` file has a date/time that is earlier than the date/time for uploaded files above.
- Run the command line such as the example below.
    - Ex: `node ddrv.js subscribe -o tmp -p DataDrive-Dev-Congruent-1 -P` or `./ddrv subscribe -o tmp -p DataDrive-Dev-Congruent-1 -P`
#### Expected Results
- Files uploaded above will **NOT** be downloaded by the CLI.

### Test 4 - Adjusting checkpoint.txt
#### Steps
- Upload files into specified package.
- Go into `<output_dir>/.datadrive/checkpoint.txt` file and adjust the date to an earlier time before uploaded files.
    - Note: The time format must be in a valid format such as... Ex: `2019-09-08T11:51:28.000-0700`.
- Run the command line such as the example below.
    - Ex: `node ddrv.js subscribe -o tmp -p DataDrive-Dev-Congruent-1 -P` or `./ddrv subscribe -o tmp -p DataDrive-Dev-Congruent-1 -P`
#### Expected Results
- Files since given date will be downloaded.

### Test 5 - Same file name
#### Steps
- CLI tries to download a file with the same file name from the middleware (even if the contents are different)
#### Expected Results
- An error will be given as the file already exists.

### Test 6 - Wildcard Filter
#### Steps
- Run the command line such as the example below.
    - Ex: `node ddrv.js subscribe -o tmp -p DataDrive-Dev-Congruent-1 -f 'msl*.txt'` or `./ddrv subscribe -o tmp -p DataDrive-Dev-Congruent-1 -f 'msl*.txt'`
- Upload a file with a file name "msl_sol_123.txt".
- Upload a file with a file name "europa_day_2345.txt".
#### Expected Results
- "msl_sol_123.txt" file will be downloaded to the `tmp` directory.
#### Cleanup
- Delete "msl_sol_123.txt" from both DataDrive web app and files in the `tmp` directory.

### Test 7 - Regex Filter
#### Steps
- Run the command line such as the example below.
    - Ex: `node ddrv.js subscribe -o tmp -p DataDrive-Dev-Congruent-1 -x 'msl.*\.txt'` or `./ddrv subscribe -o tmp -p DataDrive-Dev-Congruent-1 -x 'msl.*\.txt'`
- Upload a file with a file name "msl_sol_123.txt".
- Upload a file with a file name "europa_day_2345.txt".
#### Expected Results
- "msl_sol_123.txt" file will be downloaded to the `tmp` directory.
#### Cleanup
- Delete "msl_sol_123.txt" from both DataDrive web app and files in the `tmp` directory.

### Test 8 - Regex Filter and Wildcard Filter
#### Steps
- Run the command line such as the example below.
    - Ex: `node ddrv.js subscribe -o tmp -p DataDrive-Dev-Congruent-1 -x 'msl.*\.txt' -f 'msl*.txt'` or `ddrv subscribe -o tmp -p DataDrive-Dev-Congruent-1 -x 'msl.*\.txt' -f 'msl*.txt'`
#### Expected Results
- An error will be returned to the user as you cannot specify both regex and wildcard filter together.

### Test9 - Test out subscripts for a saved search
#### Steps
- Ensure that there is a folder called `tmp_ss` created where you will be downloading file.
- Ensure that a saved search has been created. This can be done using the DataDrive UI. Create a saved search that will filter based on a directory path in `ocs_path` field and with value of `/jeff`
- Run the command line such as the example below. Note: the `-s` flag is for the saved search name created above.
    - Ex: `node ddrv.js subscribe -o tmp_ss -s 'jeffliu_saved_search_2' -r`
- Upload a file with a name "seeme123.txt" into `/jeff` folder.
- Upload a file with a name "seemenot123.txt" not into `/jeff` folder.
#### Expected Results
- "seeme123.txt" file will be downloaded to the `tmp_ss` directory under `/jeff` folder.
#### Cleanup
- Delete "seeme123.txt" from files in the `tmp_ss` directory.
- Delete "seemenot123.txt" from files in the `tmp_ss` directory.

### Test 10 - Adjusting checkpoint.txt for a saved search
#### Steps
- This test case depends on test 9 above. Make sure that you run test 9 first.
- Go into `tmp_ss/.datadrive/checkpoint.txt` file and adjust the date to an earlier time before uploaded files in test 9.
    - Note: The time format must be in a valid format such as... Ex: `2019-09-08T11:51:28.000-0700`.
- Run the command line such as the example below.
    - Ex: `node ddrv.js subscribe -o tmp_ss -s 'jeffliu_saved_search_2' -P`
#### Expected Results
- Files since given date will be downloaded. In this case, "seeme123.txt" should be downloaded.
#### Cleanup
- Delete "seeme123.txt" from files in the `tmp_ss` directory.
