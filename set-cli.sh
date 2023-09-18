#!/usr/bin/env bash
echo "#!/usr/bin/env node" > tmp
cat cli.js >> tmp
mv tmp cli.js
chmod +x cli.js
