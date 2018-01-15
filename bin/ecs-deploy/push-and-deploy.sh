#! /bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

if [[ "$BRANCH" = "master" ]] ; then
    CLUSTER=production
    REGION=us-west-2
    SERVICE=${IMAGE}
    REMOTE_IMAGE=407997996246.dkr.ecr.us-west-2.amazonaws.com/${IMAGE}:${BRANCH}-${COMMIT}
    eval $(aws ecr get-login --region $REGION --no-include-email);
fi

echo "Pushing image to $REMOTE_IMAGE"
docker tag $IMAGE $REMOTE_IMAGE;
docker push $REMOTE_IMAGE;

echo "Deploying $BRANCH on $CLUSTER cluster"
$DIR/ecs/deploy.sh -c $CLUSTER -n $SERVICE -i $REMOTE_IMAGE -r $REGION


