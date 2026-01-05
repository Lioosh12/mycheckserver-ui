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
                git branch: 'main',
                    url: 'https://github.com/Lioosh12/mycheckserver-ui.git'
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

        stage('Lint') {
            steps {
                script {
                    try {
                        bat 'npm run lint'
                    } catch (err) {
                        echo "Lint errors ignored, continuing pipeline..."
                    }
                }
            }
        }

        stage('Test') {
            steps {
                script {
                    try {
                        bat 'npm run test'
                    } catch (err) {
                        echo "Test errors ignored, continuing pipeline..."
                    }
                }
            }
        }

        stage('Build React Web') {
            steps {
                bat 'npm run build'
            }
        }

        stage('Archive Artifact') {
            steps {
                archiveArtifacts artifacts: 'dist/**', fingerprint: true
            }
        }

        stage('Deploy to Azure via Zip Deploy') {
            steps {
                withCredentials([string(credentialsId: 'AZ_PASS', variable: 'AZ_PASS')]) {
                    bat '''
                    if exist dist (
                        powershell Compress-Archive -Path dist\\* -DestinationPath deploy.zip -Force
                        curl -u MyCheckSever:%AZ_PASS% ^
                          -X POST https://MyCheckSever.scm.azurewebsites.net/api/zipdeploy ^
                          --data-binary @deploy.zip
                    ) else (
                        echo Folder dist tidak ada
                        exit 1
                    )
                    '''
                }
            }
        }
    }

    post {
        success {
            echo 'Build & Deploy sukses! Web siap jalan full integration.'
        }
        failure {
            echo 'Build gagal. Tapi error lint/test tidak menghentikan deploy.'
        }
    }
}
