export const NODE_TEMPLATE = {
  "type": "CORE_NODE",
  "runtimeParameters": {
    "build": {
      "dependencies": [],
      "module": "realsense"
    },
    "module": "realsense",
    "type": "isaac::RealsenseCamera"
  },
  "templateVariables": {
    "inference": {
      "modelId": null,
      "enabled": false,
    },
    "training": {
      "enabled": false,
      "interval": 0,
      "consensusConfirmations": 0,
      "permissions": {
        "owner": false,
        "admin": false,
        "user": false,
        "specialist": false
      }
    },
    "settings": {
      "mapping": {
        "enabled": false,
        "propertyMaps": []
      },
      "tick": {
        "enabled": false,
        "interval": null
      },
      "parameters": {}
    }
  }
};
