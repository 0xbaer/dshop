#!/bin/bash
################################################################################
## This script will deploy the dshop backend to Heroku.  It will configure the
## application using your .env.  Make sure it has been configured to match the
## configuration you want for this deploeyd instance.
##
## Usage
## -----
## ./deploy_heroku.sh [myapp]
## 
## [myapp] will be the name of the application on Heroku.
################################################################################

APP_NAME="$1"
PWD="$(pwd)"
DIR="$(realpath "$(dirname "${BASH_SOURCE[0]}")")"
DEPLOY_DIR="/tmp/dshop-$APP_NAME-$(date +'%Y%m%d%H%M%s')"
ADD_ONS=( "heroku-postgresql" "sendgrid:starter" )
ENV_LOC=".env"
REQUIRED_ENVS=( "DATA_URL" "NETWORK_ID" "PGP_PRIVATE_KEY" "PGP_PRIVATE_KEY_PASS" "PROVIDER" "WEB3_PK" )
IFS="="  # used with `read` as delimiter for

echo " :: Deploying $APP_NAME"

echo " :: Copying backend code to build dir at $DEPLOY_DIR"
[[ -z "$TEST_RUN" ]] && mkdir $DEPLOY_DIR
[[ -z "$TEST_RUN" ]] && cp -R $DIR/* $DEPLOY_DIR/
[[ -z "$TEST_RUN" ]] && cd $DEPLOY_DIR

echo " :: Looking for .env"
test -f "$DIR/$ENV_LOC"
if [[ $? -eq "0" ]]; then
    ENV_LOC="$DIR/$ENV_LOC"
else
    test -f "$DIR/../$ENV_LOC"
    if [[ $? -eq "0" ]]; then
        ENV_LOC=$(realpath "$DIR/../$ENV_LOC")
    else
        echo "ERR .env not found!"
        exit 1
    fi
fi
echo " :: Found at $ENV_LOC"

echo " :: Checking configuration..."
for env_var in "${REQUIRED_ENVS[@]}"
do
    # Look for env var that isn't commented
    grep "$env_var=" $ENV_LOC | grep -v "^#" > 2&>1
    if [[ "$?" -ne "0" ]]; then
        echo ".env appears to be missing $env_var"
        exit 1
    fi
done

echo " :: Creating heroku application '$APP_NAME'"
[[ -z "$TEST_RUN" ]] && heroku apps:create --buildpack=heroku/nodejs $APP_NAME
# TODO, transfer to team?

echo " :: Configuring Heroku using .env file..."
while read line; do

    FIRST="${line:0:1}"
    if [[ $FIRST != "#" && $FIRST != "" ]]; then
        VAR=$(cut -d "=" -f 1 <<< "$line")
        VAL=$(cut -d "=" -f 2- <<< "$line")
        # The following removes leading and trailing quotes
        VAL="${VAL%\"}"
        VAL="${VAL#\"}"
        #echo " ::.. Setting $VAR=$VAL"
        echo " ::.. Setting $VAR"
        [[ -z "$TEST_RUN" ]] && heroku config:set -a $APP_NAME "$VAR=$VAL"
    fi

done <"$ENV_LOC"

echo " :: Configuring Heroku add-ons..."
for addon in "${ADD_ONS[@]}"
do
    echo " ::.. Attaching add-on $addon"
    [[ -z "$TEST_RUN" ]] && heroku addons:create -a $APP_NAME $addon
done

echo " :: Initializing git"
[[ -z "$TEST_RUN" ]] && git init

echo " :: Initializing git remote"
[[ -z "$TEST_RUN" ]] && heroku git:remote -a $APP_NAME

echo " :: Committing to made-up git repo"
[[ -z "$TEST_RUN" ]] && git add .
[[ -z "$TEST_RUN" ]] && git commit -m "scripted commit"

echo " :: Pushing code to heroku for deployment"
[[ -z "$TEST_RUN" ]] && git push heroku master

echo " :: Done"
cd $PWD
#rm -rf $DEPLOY_DIR
