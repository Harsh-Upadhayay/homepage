pipeline {
  agent none

  stages {
    stage('Continuous Integration') {
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
    stage('Continuous Delivery') {
      agent any
      
      stages {

        stage('Build Image') {
          steps {
            checkout scm
            sh 'docker build -t homepage:test .'
          }
        }

        // Only runs on actions on main.
        stage('Push to GHCR') {
          when {
            branch 'main'
          }

          environment {
            DOCKER_CONFIG = "${WORKSPACE}/.docker-${BUILD_NUMBER}"
          }

          steps {
            withCredentials([
              usernamePassword(
                credentialsId: 'ghcr-token-homepage',
                usernameVariable: 'GH_USER',
                passwordVariable: 'GH_PAT'
              )
            ]) {
              sh '''
                set +x
                mkdir -p "$DOCKER_CONFIG"
                printf "%s" "$GH_PAT" | docker login ghcr.io -u "$GH_USER" --password-stdin

                IMAGE_OWNER=$(printf "%s" "$GH_USER" | tr "[:upper:]" "[:lower:]")

                docker tag homepage:test ghcr.io/$IMAGE_OWNER/homepage:$BUILD_ID
                docker push ghcr.io/$IMAGE_OWNER/homepage:$BUILD_ID
              '''
            }
          }
        }
      }
    }
  }

  post {
    success {
      echo "Pipeline succeeded: ${env.JOB_NAME} #${env.BUILD_NUMBER}"
    }

    failure {
      echo "Pipeline failed: ${env.JOB_NAME} #${env.BUILD_NUMBER}"
    }

    unstable {
      echo "Pipeline unstable: ${env.JOB_NAME} #${env.BUILD_NUMBER}"
    }

    changed {
      echo "Build status changed compared to the previous run."
    }

    cleanup {
      echo "Cleaning workspace..."
      cleanWs(
        cleanWhenNotBuilt: false,
        deleteDirs: true,
        disableDeferredWipeout: true,
        notFailBuild: true
      )
    }
  }
}