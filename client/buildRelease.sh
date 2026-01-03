npm run build
#====== python webserver
# echo "py webserver"
# echo "http://localhost:8000"
# echo "http://172.20.10.2:8000"
# echo "打包完成，然后运行本地python3 webserver\n 访问地址： http://localhost:8000"
# python3 -m http.server --directory dist

VERSION=$(grep '"version"' package.json | head -1 | sed -E 's/.*"version": *"([^"]+)".*/\1/')
releaseDir="/Users/admin/Desktop/niuniu_h5_${VERSION}_release"
if [ ! -d "$releaseDir" ]; then
  mkdir -p "$releaseDir"
fi
cd build
zip -r "vue3_mg_h5_${VERSION}.zip" dist
mv "vue3_mg_h5_${VERSION}.zip" "$releaseDir"
cd ../

echo "Release版本号为：$VERSION"
echo "打包完成！"
