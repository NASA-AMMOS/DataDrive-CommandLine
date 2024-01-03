/**
* The following flags can be used to control stages of the pipeline to be run.
*/
def PIPELINE_CONTROL = [
    ci_skip: false
]

pipeline {
    agent {
        dockerfile {
            label 'cae-linux-build'
            reuseNode true
        }
    }

    environment {
        BASE_NAME = "deployment/dist/ddrv-cli-bundle"
        EXT_NAME = "zip"
        FILE_NAME = "${BASE_NAME}.${EXT_NAME}"
        ARTIFACTORY_FILE_NAME = "${BASE_NAME}-${env.BRANCH_NAME}-${env.BUILD_NUMBER}.${EXT_NAME}"
        HOME="." /* to resolve EACCES: permission denied, mkdir '/.npm'*/
        GH4JPL=credentials("eb12d339-d336-48d7-baab-c0ebcbe7eba0")
        GH_TOKEN="${GH4JPL_PSW}"
        GH_URL="https://github.jpl.nasa.gov/api/v3"
    }

    stages {
        // "Borrowed" from https://github.com/MarkAckert/staging-zowe-ims-plugin/blob/master/Jenkinsfile
        stage('Check for Skip CI') {
            steps {
                script {
                    def result = sh (returnStatus: true, script: 'git log -1 | grep \'.*\\[skip ci\\].*\'')
                    if (result == 0) {
                        echo '"skip ci" spotted in the git commit. Aborting...'
                        PIPELINE_CONTROL.ci_skip = true
                    }
                }
            }
        }

        stage("Prerequisites") {
            when { expression { return PIPELINE_CONTROL.ci_skip == false } }

            steps {
                sh("npm config set @gov.nasa.jpl.m2020.cs3:registry https://cae-artifactory.jpl.nasa.gov:443/artifactory/api/npm/npm-release-local/")
                sh("make install")
            }
        }

        stage('Test') {
            when { expression { return PIPELINE_CONTROL.ci_skip == false } }

            steps {
                sh("make test")
            }
        }

        stage('Package') {
            when {
                allOf {
                    expression { return PIPELINE_CONTROL.ci_skip == false }
                    anyOf {
                        branch "master"
                        branch "develop"
                    }
                }
            }
            steps {
                sh("make package")
                sh("cp ${FILE_NAME} ${ARTIFACTORY_FILE_NAME}")
            }
        }

        stage('Artifactory - Build') {
            when {
                allOf {
                    expression { return PIPELINE_CONTROL.ci_skip == false }
                    anyOf {
                        branch "master"
                        branch "develop"
                    }
                }
            }
            steps {
                script {
                    def server = Artifactory.newServer url: 'https://cae-artifactory.jpl.nasa.gov/artifactory', credentialsId: 'f5ab4184-4891-47f6-920e-99e2b85b3f5c'
                    // Create Upload Spec
                    //target needs to end with /
                    def uploadSpec =  """
                        {"files": [{
                            "pattern": "${ARTIFACTORY_FILE_NAME}",
                            "target": "general-develop/gov/nasa/jpl/ammos/ids/datadrive/"
                        }]}"""
                     // Upload to Artifactory.
                    def buildInfo = server.upload spec: uploadSpec
                    server.publishBuildInfo buildInfo
                }
            }
        }

        stage('Dry Run Release Github') {
            when {
                allOf {
                    branch "master"
                    expression { return PIPELINE_CONTROL.ci_skip == false }
                }
            }
            steps {
                sh ("make release-dry-run")
            }
        }

        stage('Release Github') {
            when {
                beforeInput true
                allOf {
                    branch "master"
                    expression { return PIPELINE_CONTROL.ci_skip == false }
                }
            }
            options {
                timeout(time: 1, unit: 'HOURS')
            }
            input {
                message "Does dry run look okay?"
                ok "Yes, release!"
            }
            steps {
                sh ("make release")
            }
        }

        stage('Artifactory - Version') {
            when {
                allOf {
                    branch "master"
                    expression { return PIPELINE_CONTROL.ci_skip == false }
                }
            }
            environment {
                RELEASE_VERSION = sh(script: 'cat src/release.txt', returnStdout: true).trim()
            }
            steps {
                sh("cp ${FILE_NAME} ${BASE_NAME}-${RELEASE_VERSION}.${EXT_NAME}")
                script {
                    def server = Artifactory.newServer url: 'https://cae-artifactory.jpl.nasa.gov/artifactory', credentialsId: 'f5ab4184-4891-47f6-920e-99e2b85b3f5c'
                    // Create Upload Spec
                    //target needs to end with /
                    def uploadSpec =  """
                        {"files": [{
                            "pattern": "${BASE_NAME}-${RELEASE_VERSION}.${EXT_NAME}",
                            "target": "general-develop/gov/nasa/jpl/ammos/ids/datadrive/"
                        }]}"""
                     // Upload to Artifactory.
                    def buildInfo = server.upload spec: uploadSpec
                    server.publishBuildInfo buildInfo
                }
            }
        }
    }
    post {
        success {
            deleteDir()
        }
        failure {
            deleteDir()
        }
    }
}
