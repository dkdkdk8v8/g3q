#!/bin/bash

app=client_server
appnew=client_server
chmod +x $appnew 
mkdir -p bak; mv $app bak/$app.`date "+%Y%m%d%H%M%S"`
mv $appnew $app
./$app --restart
