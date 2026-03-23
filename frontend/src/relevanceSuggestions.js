// The Ultimate BigFix Client Relevance Dictionary

export const getRelevanceSuggestions = (monaco, range) => {
  const K = monaco.languages.CompletionItemKind;

  // 1. CORE KEYWORDS
  const keywords = ['exists', 'not exists', 'number of', 'names of', 'values of', 'versions of', 'following', 'preceding', 'containing'];
  
  // 2. COMMON OBJECTS (CLASSES)
  const classes = [
    'operating system', 'computer name', 'file', 'folder', 'files', 'folders', 'registry', 'regapp', 'key', 
    'service', 'services', 'process', 'processes', 'application', 'drive', 'drives', 'processor', 'network', 
    'user', 'logged on user', 'current user', 'firewall', 'wmi', 'hardware', 'date', 'time',
    // NEW: Extended Client Classes
    'dmi', 'environment', 'bios',
    // NEW: Session Relevance Classes
    'bes computer', 'bes computers', 'bes fixlet', 'bes fixlets', 'bes action', 'bes actions', 
    'bes server', 'bes servers', 'bes product', 'bes products', 'bes computer group', 'bes computer groups', 
    'bes site', 'bes sites', 'bes domain', 'bes domains', 'bes webui', 'bes webuis', 'bes wizard', 'bes wizards', 
    'bes property', 'bes properties', 'bes property result', 'bes property results', 'bes fixlet result', 
    'bes fixlet results', 'bes action result', 'bes action results', 'bes action status'
  ];

  // 3. TIME & VARIABLES
  const variables = ['now', 'current date', 'current time'];

  // 4. THE MASSIVE PROPERTIES LIST (Added all your requested inspector properties)
  const properties = [
    // OS Properties
    'name', 'base name', 'release', 'build', 'architecture', 'machine', 'releaseid', 'windows', 'unix', 'linux', 'mac', 'embedded', 
    'display version', 'major version', 'minor version', 'build number', 'build number high', 'build number low', 'platform id', 
    'csd version', 'service pack major version', 'service pack minor version', 'suite mask', 'product type', 'product info numeric', 
    'product info string', 'display name', 'performance counter frequency', 'performance counter', 'ia64', 'x64', 'x32', 'little endian', 
    'big endian', 'uuid', 'metric', 'boot time', 'uptime', 'virtual machine', 'hypervisor',
    
    // Service Properties
    'service name', 'state', 'can interact with desktop', 'win32 exit code', 'service specific exit code', 'checkpoint', 'login account', 
    'start type', 'image path', 'win32 type', 'driver type', 'running', 'pid', 'security descriptor',
    
    // Network Properties
    'connections', 'sockets', 'winsock2 supported', 'dns servers', 'adapters', 'any adapters', 'find adapters', 'ipv4 interfaces', 
    'ipv6 interfaces', 'ipv4or6 interfaces', 'ipv4 interface', 'ipv6 interface', 'ipv4or6 interface', 'adapter', 'any adapter', 
    'interfaces', 'ip interfaces', 'interface', 'ip interface',
    
    // File Properties
    'aol error', 'aol error time', 'size', 'file version', 'product version', 'executable file format', 'windows checksum', 'variables', 
    'content', 'byte', 'locked content', 'line', 'rawline', 'lines', 'rawlines', 'lines starting with', 'rawlines starting with', 
    'lines containing', 'rawlines containing', 'locked line', 'locked rawline', 'locked lines', 'locked rawlines', 'locked lines starting with', 
    'locked rawlines starting with', 'locked lines containing', 'locked rawlines containing', 'section', 'locked section', 'locked key', 
    'md5', 'sha1', 'sha2_224', 'sha2_256', 'sha2_384', 'sha2_512', 'sha224', 'sha256', 'sha384', 'sha512', 'json', 'shortcut', 
    'sqlite database', 'version block', 'only version block', 'version blocks', 'raw version block', 'only raw version block', 
    'first raw version block', 'raw version blocks', 'raw version', 'raw file version', 'raw product version', 'pem encoded certificate', 'xml document',
    
    // Folder Properties
    'descendants', 'descendant folders', 'string named files', 'binary named files', 'find files', 'string named folders', 
    'binary named folders', 'find folders',
    
    // Firewall Properties
    'local policy', 'current profile type', 'profile types', 'service restriction', 'local policy modify state', 'rule group currently enabled', 'rules',
    
    // User Properties
    'sid', 'active directory user', 'password age', 'guest privilege', 'user privilege', 'admin privilege', 'home directory', 
    'home directory folder', 'comment', 'script flag', 'account disabled flag', 'home directory required flag', 'no password required flag', 
    'password change disabled flag', 'locked out flag', 'password expiration disabled flag', 'normal account flag', 'temporary duplicate account flag', 
    'workstation trust account flag', 'server trust account flag', 'interdomain trust account flag', 'logon script', 'print operator flag', 
    'communications operator flag', 'server operator flag', 'accounts operator flag', 'full name', 'user comment', 'application parameter string', 
    'allowed workstations string', 'last logon', 'last logoff', 'account expiration', 'maximum storage', 'bad password count', 'logon count', 
    'logon server', 'country code', 'code page', 'id', 'user id', 'primary group id', 'profile folder', 'home directory drive', 'password expired', 'domain', 'winrt packages',
    
    // Date & Time Properties
    'unique values', 'minima', 'maxima', 'extremas', 'day_of_month', 'month', 'year', 'day_of_week', 'day_of_year', 'month_and_year',
    
    // Registry Properties
    'current user key', 'application folder', 'applications', 'file extension', 'file type',
    
    // Hardware Properties
    'virtual', 'serial', 'proxied',
    
    // Drive Properties
    'volume', 'numeric type', 'type', 'free space', 'total space', 'root folder', 'fs_case_is_preserved', 'fs_case_sensitive', 
    'fs_unicode_stored_on_disk', 'fs_persistent_acls', 'fs_vol_is_compressed', 'fs_file_compression', 'file_supports_encryption', 
    'file_supports_object_ids', 'file_supports_reparse_points', 'file_supports_sparse_files', 'file_volume_quotas', 'file system type',
    
    // WMI Properties
    'select objects', 'selects',

    // ==========================================
    // NEW: EXTENDED CLIENT RELEVANCE PROPERTIES
    // ==========================================
    // Process
    'ppid', 'page fault count', 'peak working set size', 'working set size', 'quota peak paged pool usage', 'quota paged pool usage', 
    'quota peak nonpaged pool usage', 'quota nonpaged pool usage', 'page file usage', 'peak page file usage', 'io read count', 
    'io write count', 'io other count', 'io read size', 'io write size', 'io other size', 'creation time', 'kernel time', 'user time', 
    'gdi object count', 'user object count', 'handle count', 'session id', 'wow64', 'image file', 'dep enabled', 'nx bit', 'base priority',
    // DMI
    'oem_strings', 'oem_string', 'system_configuration_options', 'system_configuration_option', 'bios_informations', 'bios_information', 
    'system_informations', 'system_information', 'base_board_informations', 'base_board_information', 'system_enclosure_or_chassiss', 
    'system_enclosure_or_chassis', 'processor_informations', 'processor_information', 'memory_controller_informations', 'memory_controller_information', 
    'memory_module_informations', 'memory_module_information', 'cache_informations', 'cache_information', 'port_connector_informations', 
    'port_connector_information', 'system_slotss', 'system_slots', 'on_board_devices_informations', 'on_board_devices_information', 
    'bios_language_informations', 'bios_language_information', 'group_associationss', 'group_associations', 'physical_memory_arrays', 
    'physical_memory_array', 'memory_devices', 'memory_device', 'b32_bit_memory_error_informations', 'b32_bit_memory_error_information', 
    'memory_array_mapped_addresss', 'memory_array_mapped_address', 'memory_device_mapped_addresss', 'memory_device_mapped_address', 
    'built_in_pointing_devices', 'built_in_pointing_device', 'portable_batterys', 'portable_battery', 'system_resets', 'system_reset', 
    'hardware_securitys', 'hardware_security', 'system_power_controlss', 'system_power_controls', 'voltage_probes', 'voltage_probe', 
    'cooling_devices', 'cooling_device', 'temperature_probes', 'temperature_probe', 'electrical_current_probes', 'electrical_current_probe', 
    'out_of_band_remote_accesss', 'out_of_band_remote_access', 'system_boot_informations', 'system_boot_information', 
    'b64_bit_memory_error_informations', 'b64_bit_memory_error_information', 'management_devices', 'management_device', 
    'management_device_components', 'management_device_component', 'management_device_threshold_datas', 'management_device_threshold_data', 
    'memory_channels', 'memory_channel', 'ipmi_device_informations', 'ipmi_device_information', 'system_power_supplys', 'system_power_supply', 
    'additional_informations', 'additional_information', 'onboard_devices_extended_informations', 'onboard_devices_extended_information', 
    'inactives', 'inactive', 'end_of_tables', 'end_of_table',
    // Environment / Bios
    'x64 variables', 'variable', 'x64 variable', 'version strings', 'time zone',

    // ==========================================
    // NEW: SESSION RELEVANCE PROPERTIES
    // ==========================================
    'result from', 'comments', 'active directory path', 'sets', 'management extensions', 'bes computer group set', 'bes computer groups', 
    'database id', 'database name', 'last report time', 'cpu', 'agent type', 'device type', 'agent version', 'hostname', 'ip addresses', 
    'locked flag', 'correlation flag', 'correlation id', 'correlation', 'extension flag', 'relay server', 'root server', 'relay selection method', 
    'relay distance', 'relay server flag', 'root server flag', 'relay hostname', 'license type', 'client settings', 'reported property set', 
    'property results', 'reported action set', 'action results', 'relevant fixlet set', 'relevant fixlets', 'remediated fixlet set', 
    'remediated fixlets', 'administrator set', 'administrators', 'subscribed site set', 'subscribed sites', 'relevant fixlet count', 
    'remediated fixlet count', 'relevant', 'remediated', 'subscribed', 'administrator', 'link', 'link href', 'site', 'type', 'fixlet flag', 
    'task flag', 'analysis flag', 'group flag', 'baseline flag', 'display name', 'source', 'source id', 'source release date', 'source severity', 
    'category', 'display source', 'display source id', 'display source severity', 'display category', 'download size', 'mime fields', 'mime field', 
    'cve id list', 'sans id list', 'body', 'message', 'display message', 'digest file name', 'wizard data', 'wizard name', 'wizard link', 
    'relevance clauses', 'parent relevances', 'issuer', 'modification user', 'creation time', 'modification time', 'custom flag', 'default action', 
    'action', 'fields', 'field', 'properties', 'property', 'component groups', 'activations', 'best activation', 'applicable computer count', 
    'unlocked computer count', 'taken action set', 'taken actions', 'open action count', 'applicable computer set', 'applicable computers', 
    'remediated computer set', 'remediated computers', 'results', 'visible flag', 'globally visible flag', 'locally visible flag', 'components xml', 
    'custom site', 'master site flag', 'operator site flag', 'custom site flag', 'charset', 'tags', 'member action set', 'member actions', 
    'targeted computer set', 'parent group', 'reported computer set', 'time issued', 'targeting relevance', 'targeting method', 'untargeted flag', 
    'targeted by id flag', 'targeted by property flag', 'targeted by list flag', 'targeted names', 'selected groups string', 'targeted list', 
    'single flag', 'multiple flag', 'hidden flag', 'group member flag', 'top level flag', 'urgent flag', 'computer group flag', 'management rights flag', 
    'time stopped', 'stopper', 'applicability relevance', 'source fixlet', 'reapply flag', 'reapplication limit', 'reapplication interval', 'retry limit', 
    'retry wait for reboot flag', 'retry delay', 'start date', 'end date', 'start time_of_day', 'end time_of_day', 'time range start', 'time range end', 
    'restart flag', 'shutdown flag', 'postaction message title', 'postaction message text', 'postaction allow cancel flag', 'postaction postpone delay', 
    'postaction force delay', 'show message flag', 'message title', 'message text', 'message action button flag', 'message allow cancel flag', 
    'message postpone delay', 'message timeout delay', 'show running message flag', 'running message title', 'running message text', 
    'constrain by property name', 'constrain by property relation', 'constrain by property value', 'require user presence', 'require user absence', 
    'temporal distribution', 'success on original relevance', 'success on custom relevance', 'success on run to completion', 'custom success relevance', 
    'source relevance', 'action script', 'action script type', 'parameter', 'parameters', 'secure parameter flag', 'offer flag', 'offer description html', 
    'offer category', 'subscription flag', 'settings flag', 'date range start', 'date range end', 'expiration flag', 'expiration time', 'action dependencies', 
    'middle actions', 'start flag', 'end flag', 'continue on errors flag', 'precache flag', 'utc time flag', 'day_of_week constraints', 'fxf character set', 
    'database type', 'perpetual', 'perpetual maintenance', 'term', 'legacy', 'computer count', 'workstation count', 'windows server count', 
    'non windows server count', 'rvu count', 'client device count', 'mvs count', 'mobile count', 'cloud count', 'user count', 'device count', 
    'active container count', 'site urls', 'manual flag', 'automatic flag', 'server based flag', 'client evaluated flag', 'last refresh time', 
    'custom refresh interval flag', 'custom refresh interval', 'member set', 'members', 'external site flag', 'unified id', 'tag', 'url', 'creator', 
    'operator', 'creation date', 'globally readable flag', 'description', 'site level relevance', 'explicit owner set', 'explicit owners', 'owner set', 
    'owners', 'explicit reader set', 'explicit readers', 'reader set', 'readers', 'explicit writer set', 'explicit writers', 'writer set', 'writers', 
    'subscribed computer set', 'subscription mode', 'fixlet set', 'action set', 'site file set', 'site files', 'owner flag', 'domain set', 'domains', 
    'wizard set', 'wizards', 'custom fixlet set', 'custom fixlets', 'custom site set', 'custom sites', 'filter set', 'filters', 'dashboard id', 
    'dialog flag', 'document flag', 'requires authoring flag', 'default page name', 'navbar name', 'pre60 flag', 'menu path', 'private variable', 
    'shared variable', 'private variables', 'shared variables', 'simple name', 'display simple name', 'definition', 'reserved flag', 'default flag', 
    'keep statistics flag', 'evaluation period', 'source analysis', 'source name', 'source evaluation period', 'memory usage', 'disk usage', 
    'statistic range', 'error message', 'plural flag', 'error flag', 'value count', 'values', 'first became relevant', 'last became relevant', 
    'last became nonrelevant', 'apply count', 'retry count', 'line number', 'detailed status', 'exit code'
  ];

  // Helper functions to map our lists into Monaco's format automatically
  const mapList = (arr, kind, suffix = '') => {
    // NEW: Deduplicate to prevent double entries in the editor
    const uniqueArr = [...new Set(arr)];
    return uniqueArr.map(item => ({
      label: item + suffix,
      kind: kind,
      insertText: item + suffix + (suffix ? ' ' : ''),
      range: range
    }));
  };

  // Combine everything and add our custom Snippets at the end
  return [
    ...mapList(keywords, K.Keyword, ' '),
    ...mapList(classes, K.Class),
    ...mapList(variables, K.Variable),
    ...mapList(properties, K.Property, ' of'), // This automatically appends " of " to all your properties!
    
    // POWERFUL SNIPPETS
    { 
        label: 'if-then-else', 
        kind: K.Snippet, 
        insertText: 'if (${1:condition}) then (${2:true_result}) else (${3:false_result})', 
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, 
        documentation: 'Standard If/Then/Else statement', 
        range: range 
    },
    { 
        label: 'whose-filter', 
        kind: K.Snippet, 
        insertText: 'whose (it ${1:condition})', 
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, 
        documentation: 'Filters a plural list using the "it" keyword', 
        range: range 
    },
    // NEW SESSION COMMAND SNIPPETS
    { 
        label: 'properties whose (direct object type...)', 
        kind: K.Snippet, 
        insertText: 'properties whose (direct object type of it as string starts with "bes")', 
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, 
        documentation: 'Lists properties for BES objects', 
        range: range 
    },
    { 
        label: 'link of bes fixlet whose (id...)', 
        kind: K.Snippet, 
        insertText: 'link of bes fixlet whose (id of it is ${1:1})', 
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, 
        documentation: 'Generates a link for a specific BES Fixlet', 
        range: range 
    }
  ];
};