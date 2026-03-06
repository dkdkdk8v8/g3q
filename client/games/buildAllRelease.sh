echo "正在打包所有游戏的Release版本..."

cd qznn
./buildRelease.sh
cd ../brnn
./buildRelease.sh
cd ../bjlnn
./buildRelease.sh
cd ..

echo "所有游戏打包完成！"