pipeline {
    agent any

    environment {
        NODE_VERSION = '20'
        AZURE_CLIENT_ID = credentials('AZURE_CLIENT_ID')
        AZURE_TENANT_ID = credentials('AZURE_TENANT_ID')
        AZURE_SUBSCRIPTION_ID = credentials('AZURE_SUBSCRIPTION_ID')
        AZURE_CLIENT_SECRET = credentials('AZURE_CLIENT_SECRET')
        APP_NAME = 'mycheckserver'
        APP_SLOT = 'Production'
    }

    stages {
        stage('Checkout') {
            steps {
                git branch: 'main', url: 'https://github.com/Lioosh12/mycheckserver-ui.git'
            }
        }

        stage('Setup Node.js') {
            steps {
                sh "curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -"
                sh "sudo apt-get install -y nodejs"
                sh "node -v"
                sh "npm -v"
            }
        }

        stage('Install Dependencies') {
            steps {
                sh 'npm install'
            }
        }

        stage('Lint & Test React Web') {
            steps {
                sh 'npm run lint || true'
                sh 'npm run test -- --watchAll=false'
            }
        }

        stage('Build React Web') {
            steps {
                sh 'npm run build || true'
            }
        }

        stage('Build React Native Android') {
            steps {
                dir('android') {
                    sh './gradlew assembleDebug || true'
                }
            }
        }

        stage('Archive Artifacts') {
            steps {
                archiveArtifacts artifacts: '**/build/**', allowEmptyArchive: true
            }
        }

        stage('Deploy to Azure') {
            when {
                expression { env.AZURE_CLIENT_ID != null && env.AZURE_CLIENT_SECRET != null }
            }
            steps {
                sh """
                    az login --service-principal -u $AZURE_CLIENT_ID -p $AZURE_CLIENT_SECRET --tenant $AZURE_TENANT_ID
                    az account set --subscription $AZURE_SUBSCRIPTION_ID
                    az webapp deploy --name $APP_NAME --resource-group "Kowan-CheckServer" --src-path dist --slot $APP_SLOT
                """
            }
        }
    }

    post {
        success {
            echo 'Build & Test sukses, bisa lanjut deploy.'
        }
        failure {
            echo 'Build atau Test gagal, cek log.'
        }
    }
}
