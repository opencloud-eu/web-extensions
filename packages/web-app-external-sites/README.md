# web-app-external-sites

This application can be used for adding external sites to the application menu of OpenCloud Web. External sites can either be opened in a new tab/window or embedded within OpenCloud Web via an iFrame.

## Configuration

The configuration for the external-sites app may look like so:

```
"config": {
  "sites": [
    {
      "name": "OpenCloud",
      "url": "https://www.opencloud.eu",
      "target": "external",
      "color": "#0D856F",
      "icon": "cloud",
      "priority": 50
    }
  ]
}
```

The `name` will appear in the app menu, while `url` specifies the url which will be opened or embedded. `target` can either be `external` or `embedded`. Choose `external` if the site should be opened in a new tab or window. Choose `embedded` if the external content should be embedded within OpenCloud Web. Note that the target server needs to allow being embedded via its CORS settings. The server running OpenCloud on the other hand needs to allow embedding the target via its CSP rules. If you don't have control over any of the server's CORS or CSP settings, just test it. If embedded doesn't work for the specified url then you need to use `external` instead.

All of these 3 config options are required.

The following attributes are optional:

- **`color`** _(string)_ - specifies the Hex color codes of the icon background of the menu item.
- **`target`** _(enum)_ - `["external"|"embedded"]` specifies the target in wich the url gets opened. Defaults to `external`. See explanation above
- **`icon`** _(string)_ - specifies the name of a [Remix Icon](https://remixicon.com/) to be used for the menu item.
- **`priority`** _(number)_ - specifies the order of the menu item. `50` is probably a good place to start, then go up/down based on where the item should be placed. Defaults to the highest possible number, so the item will most likely end up at the bottom of the list.
- **`visibility`** _(object, optional)_ – "Visibility Control" for displaying sites based on user groups. See the explanation below.

## Dashboards

You can also group external sites under so-called dashboards. These appear as dedicated pages in the menu.

### Example

```json
"config": {
  "defaultDashboard": "My Dashboard",
  "dashboards": [
    {
      "name": "My Dashboard",
      "path": "/dashboard",
      "color": "#ff9800",
      "icon": "grid",
      "sites": [
        {
          "name": "Plex",
          "url": "https://plex.local",
          "color": "#e5a00d",
          "icon": "play",
          "description": "Multimedia streaming service"
        },
        {
          "name": "Office",
          "sites": [
            {
              "name": "Paperless NGX",
              "url": "https://paperless.local",
              "color": "#17541f",
              "icon": "leaf",
              "description": "Document management system."
            },
            {
              "name": "Printer Web UI",
              "url": "http://printer.local",
              "color": "#0096d6",
              "icon": "printer",
              "description": "Administration panel and web scan."
            }
          ]
        }
      ]
    }
  ]
}
```

### Dashboard Options

**`dashboards`** - _(array, optional)_

Each dashboard object supports the following fields:

- **`name`** _(string, required)_ – Display name shown in the app menu and as title on the page.
- **`path`** _(string, required)_ – Route under which the dashboard will be available. This is appended to `/external-sites`.
- **`sites`** _(array, required)_ – List of entries shown on the dashboard. These can be:
  - A **site**, which includes at least `name` and `url`, or
  - A **group**, which includes a `name` and a nested `sites` array of individual site entries.

A Site includes every field from "External Sites" above including `priority` (ordered within the group) and `target`. \
Sites not inside a group are shown above the groups without a headline.

**`defaultDashboard`** _(string, optional)_ - Set the default dashboard when this application is used as default application. If not set, the first one is used.

### Optional Dashboard Attributes

- **`color`** _(string)_ – Specifies the hex color code of the icon background for the dashboard.
- **`icon`** _(string)_ – Specifies the name of a [Remix Icon](https://remixicon.com/) to be used for the dashboard menu item.
- **`visibility`** _(object)_ – "Visibility Control" for displaying sites based on user groups. See the explanation below.

## Visibility

> [!IMPORTANT]  
> We're loading the complete site configuration, including visibility-controlled sites, within config.json.
> The purpose of this feature isn't security, but rather to offer a more user-friendly way of presenting certain
> menu entries, preventing potential confusion for particular user segments.
> _**Please be aware that sensitive URLs should not be hidden using this method, as they are still retrievable from the config.json file.**_

Visibility offers a way of hiding certain Menu/Dashboard sites via user groups.

### Example

```json
  "config": {
    "sites": [
      {
        "name": "OpenCloud",
        "url": "https://opencloud.eu",
        "target": "external",
        "color": "#0D856F",
        "icon": "book",
        "priority": 50
      },
      {
        "name": "Only Visible to users with admin group",
        "url": "https://opencloud.eu",
        "target": "external",
        "color": "#0D856F",
        "icon": "book",
        "priority": 50,
        "visibility":
        {
          "groups":{
            "any": [ "admin" ]
          }
        }
      }
    ],
    "defaultDashboard": "My Dashboard",
    "dashboards": [
      {
        "name": "My Dashboard",
        "path": "/dashboard",
        "color": "#ff9800",
        "icon": "grid",
        "sites": [
          {
            "name": "Plex",
            "url": "https://plex.local",
            "color": "#e5a00d",
            "icon": "play",
            "description": "Multimedia streaming service",
            "visibility":
            {
              "groups":
              {
                "any": [ "editor", "admin" ],
                "all": [ "verified" ],
                "none": [ "suspended" ]
              }
            }
          },
          {
            "name": "Documentation",
            "url": "https://docs.opencloud.eu",
            "color": "#E2BAFF",
            "target": "embedded",
            "icon": "cloud",
            "description": "OpenCloud Documentation"
          },
          {
            "name": "Office",
            "sites": [
              {
                "name": "Paperless NGX",
                "url": "https://paperless.local",
                "color": "#17541f",
                "icon": "leaf",
                "priority": 50,
                "description": "Document management system."
              },
              {
                "name": "Printer Web UI",
                "url": "http://printer.local",
                "color": "#0096d6",
                "icon": "printer",
                "priority": 40,
                "description": "Administration panel and web scan."
              }
            ]
          }
        ]
      }
    ]
  }
```

<details><summary>Via apps.yaml file</summary>

```yaml
external-sites:
  config:
    sites:
      - name: OpenCloud
        url: https://opencloud.eu
        target: external
        color: '#0D856F'
        icon: book
        priority: 50
      - name: Only Visible to users with admin group
        url: https://opencloud.eu
        target: external
        color: '#0D856F'
        icon: book
        priority: 50
        visibility:
          groups:
            any:
              - admin
    defaultDashboard: My Dashboard
    dashboards:
      - name: My Dashboard
        path: /dashboard
        color: '#ff9800'
        icon: grid
        sites:
          - name: Plex
            url: https://plex.local
            color: '#e5a00d'
            icon: play
            description: Multimedia streaming service
            visibility:
              groups:
                any:
                  - editor
                  - admin
                all:
                  - verified
                none:
                  - suspended
          - name: Documentation
            url: https://docs.opencloud.eu
            color: '#E2BAFF'
            target: embedded
            icon: cloud
            description: OpenCloud Documentation
          - name: Office
            sites:
              - name: Paperless NGX
                url: https://paperless.local
                color: '#17541f'
                icon: leaf
                priority: 50
                description: Document management system.
              - name: Printer Web UI
                url: http://printer.local
                color: '#0096d6'
                icon: printer
                priority: 40
                description: Administration panel and web scan.
```

</details>

For more example see [../../dev/docker/opencloud.apps.yaml](../../dev/docker/opencloud.apps.yaml)

### Visibility Options

`visibility` (object, optional)

Each visibility object must have a `groups` field within the groups you can have one or all options `any`,`all`,`none`

`groups` (object, required)

- `any` (array, at least one is required)
- `all` (array, at least one is required)
- `none` (array, at least one is required)

```json
"visibility":
    {
      "groups":
      {
        "any": [ "editor", "admin" ],
        "all": [ "verified" ],
        "none": [ "suspended" ]
      }
    }
```

<details><summary>Yaml Example file</summary>

```yaml
visibility:
  groups:
    any: ['editor', 'admin'] # Must have editor OR admin
    all: ['verified'] # Must also have verified
    none: ['suspended'] # Must NOT have suspended
```

</details>

Please refer to [the Web app docs](https://docs.opencloud.eu/docs/admin/configuration/web-applications) if you want to learn how to configure a Web app.
