#!/bin/sh
set -eu
NOTION_API_KEY="$(cat "${CREDENTIALS_DIRECTORY}/notion")"
BLACKBOOK_OWNER_PASSWORD="$(cat "${CREDENTIALS_DIRECTORY}/owner-password")"
: "${NOTION_API_KEY:?Notion credential is empty}"
: "${BLACKBOOK_OWNER_PASSWORD:?Owner password is empty}"
export NOTION_API_KEY BLACKBOOK_OWNER_PASSWORD
exec /opt/blackbook/node/bin/node ./node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3000
