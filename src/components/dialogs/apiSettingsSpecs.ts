import { DropdownOption } from '@/components/common'
import { ApiSettingsSpec } from './ApiSettingsDialog'

const DLC_STATUS_OPTIONS: DropdownOption<string>[] = [
  { value: 'unlocked', label: 'Unlocked' },
  { value: 'locked', label: 'Locked' },
  { value: 'original', label: 'Original' },
]

export const smokeApiSettingsSpec: ApiSettingsSpec = {
  dialogTitle: 'SmokeAPI Settings',
  enableLabel: 'Enable SmokeAPI Configuration',
  enableSublabel: 'Enable this to customize SmokeAPI settings for this game',
  defaultConfig: {
    $schema:
      'https://raw.githubusercontent.com/acidicoala/SmokeAPI/refs/tags/v4.0.0/res/SmokeAPI.schema.json',
    $version: 4,
    logging: false,
    log_steam_http: false,
    default_app_status: 'unlocked',
    override_app_status: {},
    override_dlc_status: {},
    auto_inject_inventory: true,
    extra_inventory_items: [],
    extra_dlcs: {},
  },
  readCommand: 'read_smokeapi_config',
  writeCommand: 'write_smokeapi_config',
  deleteCommand: 'delete_smokeapi_config',
  sections: [
    {
      title: 'General Settings',
      fields: [
        {
          kind: 'dropdown',
          key: 'default_app_status',
          label: 'Default App Status',
          description: 'Specifies the default DLC status',
          options: DLC_STATUS_OPTIONS,
        },
      ],
    },
    {
      title: 'Logging',
      fields: [
        {
          kind: 'checkbox',
          key: 'logging',
          label: 'Enable Logging',
          sublabel: 'Enables logging to SmokeAPI.log.log file',
        },
        {
          kind: 'checkbox',
          key: 'log_steam_http',
          label: 'Log Steam HTTP',
          sublabel: 'Toggles logging of SteamHTTP traffic',
        },
      ],
    },
    {
      title: 'Inventory',
      fields: [
        {
          kind: 'checkbox',
          key: 'auto_inject_inventory',
          label: 'Auto Inject Inventory',
          sublabel:
            'Automatically inject a list of all registered inventory items when the game queries user inventory',
        },
      ],
    },
  ],
}

export const screamApiSettingsSpec: ApiSettingsSpec = {
  dialogTitle: 'ScreamAPI Settings',
  enableLabel: 'Enable ScreamAPI Configuration',
  enableSublabel: 'Enable this to customise ScreamAPI settings for this game',
  defaultConfig: {
    $schema: 'https://raw.githubusercontent.com/acidicoala/ScreamAPI/master/res/ScreamAPI.schema.json',
    $version: 3,
    logging: false,
    log_eos: false,
    block_metrics: false,
    namespace_id: '',
    default_dlc_status: 'unlocked',
    override_dlc_status: {},
    extra_graphql_endpoints: [],
    extra_entitlements: {},
  },
  readCommand: 'read_screamapi_config',
  writeCommand: 'write_screamapi_config',
  deleteCommand: 'delete_screamapi_config',
  sections: [
    {
      title: 'General Settings',
      fields: [
        {
          kind: 'dropdown',
          key: 'default_dlc_status',
          label: 'Default DLC Status',
          description: 'Specifies the default DLC unlock status',
          options: DLC_STATUS_OPTIONS,
        },
      ],
    },
    {
      title: 'Logging',
      fields: [
        {
          kind: 'checkbox',
          key: 'logging',
          label: 'Enable Logging',
          sublabel: 'Enables logging to ScreamAPI.log.log file',
        },
        {
          kind: 'checkbox',
          key: 'log_eos',
          label: 'Log EOS SDK',
          sublabel: 'Intercept and log EOS SDK calls (requires logging enabled)',
        },
      ],
    },
    {
      title: 'Privacy',
      fields: [
        {
          kind: 'checkbox',
          key: 'block_metrics',
          label: 'Block Metrics',
          sublabel: 'Block game analytics/usage reporting to Epic Online Services',
        },
      ],
    },
  ],
}
