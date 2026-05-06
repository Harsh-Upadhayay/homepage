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
    stage('Build Docker image') {
      agent any
      steps {
        checkout scm
        sh 'docker build -t homepage:test .'
      }
    }
  }
}
