#!/bin/bash

app=main_robot
appnew=build_main_robot
chmod +x $appnew 
mkdir -p bak; mv $app bak/$app.`date "+%Y%m%d%H%M%S"`
mv $appnew $app
./$app --restart
