package main

import (
	"go.viam.com/rdk/components/generic"
	"go.viam.com/rdk/module"
	"go.viam.com/rdk/resource"
)

func main() {
	module.ModularMain(
		resource.APIModel{generic.API, Model},
	)
}

var Model = resource.ModelNamespace("ncs").WithFamily("sanding-monitoring-web-app").WithModel("sanding-monitoring-web-app")

func init() {
	resource.RegisterComponent(
		generic.API,
		Model,
		resource.Registration[resource.Resource, resource.NoNativeConfig]{})
}
