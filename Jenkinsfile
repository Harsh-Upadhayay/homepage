pipeline {
  agent none

  stages {
    stage('App checks') {
      agent {
        // Jenkins will auto checkout the code before running the steps (Default behavior of Jenkins when using a docker agent)
        dockerfile {
          filename 'Dockerfile'
          additionalBuildArgs '--target=deps'
          args '-u root'
        }
      }
      //  Nested stages to run in the same container
      stages {

        stage('Check node version') {
          steps {
            sh 'node -v'
          }
        }

        stage('Check npm version') {
          steps {
            sh 'npm -v'
          }
        }

        stage('Install dependencies') {
          steps {
            sh 'npm ci'
          }
        }

        stage('Lint') {
          steps {
            sh 'npm run lint'
          }
        }

        stage('Build app') {
          steps {
            sh 'npm run build'
          }
        }
      }   
    }

    // This can run on different env, that's why first checkout scm.
    stage('Continous Delivery') {
      agent any
      
      stages {

        stage('Build Image') {
          steps {
            checkout scm
            sh 'docker build -t homepage:test .'
          }
        }

        // Only runs on actions on main.
        stage ('Push to GHCR') {
          when {
            branch 'main'
          }
        }
        steps {

          withCredentials([usernamePassword(credentialsId: 'ghcr-token-homepage', 
                                            passwordVariable: 'GH_PAT', 
                                            usernameVariable: 'GH_USER')]) {
              // 1. Authenticate 
              // We use \$ to ensure the shell handles the secret safely
              sh "echo \$GH_PAT | docker login ghcr.io -u \$GH_USER --password-stdin"
              
              // 2. Tag and Push 
              // GHCR requires lowercase, so we call .toLowerCase() on the Groovy variable
              sh "docker tag homepage:test ghcr.io/${GH_USER.toLowerCase()}/homepage:${env.BUILD_ID}"
              sh "docker push ghcr.io/${GH_USER.toLowerCase()}/homepage:${env.BUILD_ID}"
          }

        }

      }

    }
  }
}
// Testa