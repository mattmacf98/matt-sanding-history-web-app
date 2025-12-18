module: dist/index.html meta.json bin/sanding-history-web-app
	tar czf module.tar.gz meta.json dist bin/sanding-history-web-app

dist/index.html: node_modules
	npm run build

node_modules: package.json
	npm install

setup-linux:
	which npm > /dev/null 2>&1 || \
	curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
	apt-get install -y nodejs

bin:
	mkdir -p bin

bin/sanding-history-web-app: bin module.go
	go build -o bin/sanding-history-web-app module.go