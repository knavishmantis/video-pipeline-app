#!/bin/bash
# Simulate Docker build structure
mkdir -p /tmp/docker-test/app
cd /tmp/docker-test
cp -r /home/quinncaverly/Projects/video-pipeline-app/backend/* app/
cp -r /home/quinncaverly/Projects/video-pipeline-app/shared .
cd app
# Test if the import path works
node -e "console.log(require('path').resolve('src/controllers/auth.ts'))"
cd ../..
rm -rf /tmp/docker-test
echo "Structure test complete"
