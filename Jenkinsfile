pipeline {
    agent any

    environment {
        APP_DIST = 'dist'
    }

    tools {
        nodejs "NodeJS 20" // pastiin nama ini sama persis di Jenkins Global Tool Config
    }

    stages {
        stage('Checkout') {
            steps {
                git branch: 'main', url: 'https://github.com/Lioosh12/mycheckserver-ui.git'
            }
        }

        stage('Check Node & NPM') {
            steps {
                sh 'node -v'
                sh 'npm -v'
            }
        }

        stage('Install Dependencies') {
            steps {
                sh 'npm install'
            }
        }

        stage('Lint & Test') {
            steps {
                // Lint tetap jalan walau error
                sh 'npm run lint || true'
                sh 'npm run test -- --watchAll=false'
            }
        }

        stage('Build React Web') {
            steps {
                sh 'npm run build'
            }
        }

        stage('Archive Artifact') {
            steps {
                archiveArtifacts artifacts: "${APP_DIST}/**", allowEmptyArchive: false
            }
        }

        stage('Deploy to Azure via Zip Deploy') {
            steps {
                withCredentials([usernamePassword(credentialsId: 'AZURE_PUBLISH', usernameVariable: 'AZ_USER', passwordVariable: 'AZ_PASS')]) {
                    sh """
                    if [ -d "${APP_DIST}" ]; then
                        zip -r deploy.zip ${APP_DIST}
                        curl -X POST -u $AZ_USER:$AZ_PASS https://mycheckserver.scm.azurewebsites.net/api/zipdeploy --data-binary @deploy.zip
                    else
                        echo "❌ Folder ${APP_DIST} tidak ada, build gagal!"
                        exit 1
                    fi
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
