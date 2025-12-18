package main

import (
	"go.viam.com/rdk/components/generic"
	"go.viam.com/rdk/module"
	"go.viam.com/rdk/resource"
)

// APP-14732 this is a temporary work around until we can have the viam build gh action deploy with only a viam app

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
