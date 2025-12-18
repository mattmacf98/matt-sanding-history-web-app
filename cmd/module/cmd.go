package main

import (
	"go.viam.com/rdk/components/generic"
	"go.viam.com/rdk/module"
	"go.viam.com/rdk/resource"

	sandingHistoryWebApp "github.com/mattmacf98/matt-sanding-history-web-app"
)

func main() {
	module.ModularMain(
		resource.APIModel{generic.API, sandingHistoryWebApp.Model},
	)

}
