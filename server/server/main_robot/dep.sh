#!/bin/bash

app=robot_server
appnew=build_robot_server
chmod +x $appnew 
mkdir -p bak; mv $app bak/$app.`date "+%Y%m%d%H%M%S"`
mv $appnew $app
./$app --restart
