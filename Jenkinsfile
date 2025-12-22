pipeline {
    agent any

    environment {
        NODE_HOME = tool name: 'NodeJS 20', type: 'NodeJS'
        APP_DIST = 'dist'
    }

    stages {
        stage('Checkout') {
            steps {
                git branch: 'main', url: 'https://github.com/Lioosh12/mycheckserver-ui.git'
            }
        }

        stage('Install Dependencies') {
            steps {
                sh "${NODE_HOME}/bin/npm install"
            }
        }

        stage('Lint & Test') {
            steps {
                sh "${NODE_HOME}/bin/npm run lint || true"
                sh "${NODE_HOME}/bin/npm run test -- --watchAll=false"
            }
        }

        stage('Build React Web') {
            steps {
                sh "${NODE_HOME}/bin/npm run build"
            }
        }

        stage('Archive Artifact') {
            steps {
                archiveArtifacts artifacts: 'dist/**', allowEmptyArchive: false
            }
        }

        stage('Deploy to Azure via Zip Deploy') {
            steps {
                withCredentials([usernamePassword(credentialsId: 'AZURE_PUBLISH', usernameVariable: 'AZ_USER', passwordVariable: 'AZ_PASS')]) {
                    sh """
                    zip -r deploy.zip ${APP_DIST}
                    curl -X POST -u $AZ_USER:$AZ_PASS https://mycheckserver.scm.azurewebsites.net/api/zipdeploy --data-binary @deploy.zip
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
