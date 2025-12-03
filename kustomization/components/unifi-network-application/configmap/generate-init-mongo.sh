#!/bin/sh

if [ -z "${MONGO_PASS}" ]; then
    echo "MONGO_PASS must be set!"
    exit 1
fi

echo "db.getSiblingDB(\"unifi\")
  .createUser({
    user: \"unifi\",
    pwd: \"${MONGO_PASS}\",
    roles: [
      {role: \"dbOwner\", db: \"unifi\"}
    ]
  });
db.getSiblingDB(\"unifi_audit\")
  .createUser({
    user: \"unifi\",
    pwd: \"${MONGO_PASS}\",
    roles: [
      {role: \"dbOwner\", db: \"unifi_audit\"}
    ]
  });
db.getSiblingDB(\"unifi_stat\")
  .createUser({
    user: \"unifi\",
    pwd: \"${MONGO_PASS}\",
    roles: [
      {role: \"dbOwner\", db: \"unifi_stat\"}
    ]
  });
db.adminCommand({setFeatureCompatibilityVersion: '8.0', confirm: true})" > /docker-entrypoint-initdb.d/init-mongo.js
