pipeline {
    agent any

    environment {
        APP_DIST = 'dist'
    }

    tools {
        nodejs "NodeJS 20" 
    }

    stages {
        stage('Checkout SCM') {
            steps {
                git branch: 'main', url: 'https://github.com/Lioosh12/mycheckserver-ui.git'
            }
        }

        stage('Check Node & NPM') {
            steps {
                bat 'node -v'
                bat 'npm -v'
            }
        }

        stage('Install Dependencies') {
            steps {
                bat 'npm install'
            }
        }

        stage('Lint & Test') {
            steps {
                // Lint error nggak bikin gagal
                bat 'npm run lint || exit 0' 

                // Run all tests
                bat 'npm run test -- --watchAll=false'
            }
        }

        stage('Build React Web') {
            steps {
                bat 'npm run build'
            }
        }

        stage('Archive Artifact') {
            steps {
                archiveArtifacts artifacts: "${APP_DIST}\\**", allowEmptyArchive: false
            }
        }

        stage('Deploy to Azure via Zip Deploy') {
            steps {
                withCredentials([usernamePassword(credentialsId: 'AZURE_PUBLISH', usernameVariable: 'AZ_USER', passwordVariable: 'AZ_PASS')]) {
                    bat """
                    if exist ${APP_DIST} (
                        powershell Compress-Archive -Path ${APP_DIST}\\* -DestinationPath deploy.zip -Force
                        curl -u %AZ_USER%:%AZ_PASS% -X POST https://mycheckserver.scm.azurewebsites.net/api/zipdeploy --data-binary @deploy.zip
                    ) else (
                        echo Folder ${APP_DIST} tidak ada, build gagal!
                        exit 1
                    )
                    """
                }
            }
        }
    }

    post {
        success {
            echo '✅ Build & Deploy sukses!'
        }
        failure {
            echo '❌ Ada error, cek log Jenkins.'
        }
    }
}
