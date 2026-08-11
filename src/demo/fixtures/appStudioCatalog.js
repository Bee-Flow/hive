/**
 * Trimmed snapshot of the server's App Studio catalog (buildCatalog() in
 * server/appStudio/componentSpecs.js), generated 2026-08-07 on the
 * app-studio-v3 working tree.
 *
 * WHY A SNAPSHOT AND NOT AN IMPORT: the server module cannot be imported
 * into the client bundle, and the demo must answer GET /api/studio-apps/
 * catalog without the network. Drift is harmless by construction: the
 * editor palette comes from the CLIENT componentRegistry, so a component
 * missing here still appears - the catalog is only read for palette card
 * descriptions (ComponentRibbon), the generic inspector prop specs
 * (SpecPanel), computed-props specs and mailbox table templates.
 *
 * `components` is deliberately restricted to the types the fixture app
 * uses plus the ones a visitor is most likely to drop; everything else in
 * the object is the full catalog verbatim.
 */
export const DEMO_CATALOG = {
    "schemaVersion": 2,
    "acceptedSchemaVersions": [
        1,
        2
    ],
    "limits": {
        "MAX_SCREENS": 40,
        "MAX_SECTIONS_PER_SCREEN": 40,
        "MAX_TOTAL_NODES": 500,
        "MAX_ACTIONS": 60,
        "MAX_DEPTH": 6,
        "MAX_STRING": 5000,
        "MAX_DEFINITION_BYTES": 524288,
        "MAX_SELECT_OPTIONS": 100,
        "MAX_TABLE_COLUMNS": 12,
        "MAX_KEYVALUE_FIELDS": 20,
        "MAX_STATIC_ROWS": 200,
        "MAX_NAME_LEN": 80,
        "MAX_FORMULA_LEN": 2000,
        "MAX_VALIDATIONS_PER_FIELD": 10,
        "MAX_ACTION_STEPS": 30,
        "MAX_ACTION_DEPTH": 4,
        "MAX_ACTION_LOOP_ITERATIONS": 200,
        "MAX_DATA_GRID_COLUMNS": 20,
        "MAX_CHART_SERIES": 12,
        "MAX_ROLES": 20,
        "MAX_NAVIGATE_PARAMS": 20,
        "MAX_KANBAN_COLUMNS": 12,
        "MAX_RECORD_DETAIL_FIELDS": 30,
        "MAX_FILTER_BAR_FIELDS": 8,
        "MAX_STEPPER_STEPS": 10
    },
    "theme": {
        "primary": {
            "type": "color",
            "default": "#0F766E",
            "presets": [
                "#0F766E",
                "#0369A1",
                "#1D4ED8",
                "#0891B2",
                "#047857",
                "#4D7C0F",
                "#B45309",
                "#C2410C",
                "#B91C1C",
                "#BE185D",
                "#334155",
                "#57534E"
            ]
        },
        "radius": {
            "type": "enum",
            "values": [
                "none",
                "sm",
                "md",
                "lg",
                "xl"
            ],
            "default": "md"
        },
        "density": {
            "type": "enum",
            "values": [
                "compact",
                "comfortable",
                "spacious"
            ],
            "default": "comfortable"
        },
        "fontScale": {
            "type": "enum",
            "values": [
                "sm",
                "md",
                "lg"
            ],
            "default": "md"
        },
        "appearance": {
            "type": "enum",
            "values": [
                "light",
                "dark",
                "auto"
            ],
            "default": "auto"
        }
    },
    "styleKnobs": {
        "span": {
            "type": "int",
            "min": 1,
            "max": 12,
            "step": 1,
            "default": 12
        },
        "size": {
            "type": "enum",
            "values": [
                "sm",
                "md",
                "lg"
            ],
            "default": "md"
        },
        "align": {
            "type": "enum",
            "values": [
                "start",
                "center",
                "end"
            ],
            "default": "start"
        },
        "color": {
            "type": "colorOrRole",
            "roles": [
                "primary",
                "neutral",
                "success",
                "warning",
                "danger",
                "info"
            ],
            "default": null
        },
        "radius": {
            "type": "enum",
            "values": [
                null,
                "none",
                "sm",
                "md",
                "lg",
                "full"
            ],
            "default": null
        },
        "padding": {
            "type": "int",
            "min": 0,
            "max": 6,
            "step": 1,
            "default": 0
        },
        "gap": {
            "type": "int",
            "min": 0,
            "max": 6,
            "step": 1,
            "default": 3
        },
        "weight": {
            "type": "enum",
            "values": [
                "regular",
                "medium",
                "semibold"
            ],
            "default": "regular"
        },
        "height": {
            "type": "enum",
            "values": [
                "auto",
                "sm",
                "md",
                "lg",
                "fill"
            ],
            "default": "auto"
        },
        "background": {
            "type": "enum",
            "values": [
                "none",
                "surface",
                "tint"
            ],
            "default": "none"
        },
        "border": {
            "type": "enum",
            "values": [
                "none",
                "subtle",
                "default"
            ],
            "default": "none"
        }
    },
    "colorRoles": [
        "primary",
        "neutral",
        "success",
        "warning",
        "danger",
        "info"
    ],
    "screen": {
        "name": {
            "type": "string",
            "required": true,
            "maxLen": 60,
            "default": "Screen"
        },
        "icon": {
            "type": "icon",
            "default": null
        },
        "showInNav": {
            "type": "boolean",
            "default": true
        },
        "maxWidth": {
            "type": "enum",
            "values": [
                "narrow",
                "medium",
                "wide",
                "full"
            ],
            "default": "medium"
        },
        "kind": {
            "type": "enum",
            "values": [
                null,
                "dashboard"
            ],
            "default": null
        },
        "description": {
            "type": "string",
            "maxLen": 120,
            "default": null
        },
        "refreshInterval": {
            "type": "enum",
            "values": [
                0,
                15,
                30,
                60,
                300
            ],
            "default": 0
        }
    },
    "section": {
        "styleKnobs": [
            "padding",
            "gap",
            "background",
            "height"
        ],
        "defaultStyle": {
            "padding": 4,
            "gap": 3,
            "background": "none"
        }
    },
    "components": {
        "heading": {
            "label": "Heading",
            "category": "Content",
            "description": "A section or page title.",
            "props": {
                "text": {
                    "type": "string",
                    "required": true,
                    "maxLen": 200,
                    "default": "Heading"
                },
                "level": {
                    "type": "int",
                    "min": 1,
                    "max": 3,
                    "default": 2
                }
            },
            "styleKnobs": [
                "span",
                "align",
                "color"
            ],
            "defaultStyle": {
                "span": 12
            }
        },
        "text": {
            "label": "Text",
            "category": "Content",
            "description": "A paragraph of text. Supports a small markdown subset (bold, italic, links).",
            "props": {
                "text": {
                    "type": "markdown",
                    "required": true,
                    "default": "Text"
                },
                "muted": {
                    "type": "boolean",
                    "default": false
                }
            },
            "styleKnobs": [
                "span",
                "align",
                "color",
                "weight",
                "size"
            ],
            "defaultStyle": {
                "span": 12
            }
        },
        "filter_bar": {
            "label": "Filter bar",
            "category": "Data",
            "description": "A row of filter controls (search, select, toggle, date). Each control writes vars.filters.<name>, for use in records-binding filter formulas.",
            "props": {
                "fields": {
                    "type": "list",
                    "maxItems": 8,
                    "default": [],
                    "itemShape": {
                        "name": {
                            "type": "string",
                            "required": true,
                            "maxLen": 60
                        },
                        "label": {
                            "type": "string",
                            "maxLen": 120
                        },
                        "type": {
                            "type": "enum",
                            "values": [
                                "search",
                                "select",
                                "toggle",
                                "date"
                            ],
                            "default": "search"
                        },
                        "options": {
                            "type": "list",
                            "maxItems": 100,
                            "default": [],
                            "itemShape": {
                                "value": {
                                    "type": "string",
                                    "required": true,
                                    "maxLen": 200
                                },
                                "label": {
                                    "type": "string",
                                    "maxLen": 200
                                }
                            }
                        }
                    }
                }
            },
            "styleKnobs": [
                "span",
                "size",
                "gap"
            ],
            "defaultStyle": {
                "span": 12
            }
        },
        "kanban": {
            "label": "Kanban",
            "category": "Data",
            "description": "A kanban board over an array of objects, grouped into columns by groupByField. Dragging a card fires onCardMove with { item, value } (the moved row and the target column value).",
            "events": [
                "onRowClick",
                "onCardMove"
            ],
            "props": {
                "source": {
                    "type": "binding",
                    "default": {
                        "kind": "static",
                        "value": []
                    }
                },
                "groupByField": {
                    "type": "string",
                    "required": true,
                    "maxLen": 120,
                    "default": "status"
                },
                "columns": {
                    "type": "list",
                    "maxItems": 12,
                    "default": [],
                    "itemShape": {
                        "value": {
                            "type": "string",
                            "required": true,
                            "maxLen": 200
                        },
                        "label": {
                            "type": "string",
                            "maxLen": 120
                        },
                        "color": {
                            "type": "enum",
                            "values": [
                                "primary",
                                "neutral",
                                "success",
                                "warning",
                                "danger",
                                "info"
                            ],
                            "default": "neutral"
                        }
                    }
                },
                "titleKey": {
                    "type": "string",
                    "maxLen": 120,
                    "default": "title"
                },
                "subtitleKey": {
                    "type": "string",
                    "maxLen": 120,
                    "default": null
                },
                "badgeKey": {
                    "type": "string",
                    "maxLen": 120,
                    "default": null
                },
                "allowDrag": {
                    "type": "boolean",
                    "default": true
                }
            },
            "styleKnobs": [
                "span",
                "size",
                "height"
            ],
            "defaultStyle": {
                "span": 12
            }
        },
        "record_detail": {
            "label": "Record detail",
            "category": "Data",
            "description": "Labeled fields of ONE record â€” typically a {kind:\"record\"} binding whose filter uses screen.params (pairs with navigate params).",
            "props": {
                "source": {
                    "type": "binding",
                    "default": {
                        "kind": "static",
                        "value": null
                    }
                },
                "fields": {
                    "type": "list",
                    "maxItems": 30,
                    "default": [],
                    "itemShape": {
                        "key": {
                            "type": "string",
                            "required": true,
                            "maxLen": 120
                        },
                        "label": {
                            "type": "string",
                            "maxLen": 120
                        },
                        "format": {
                            "type": "enum",
                            "values": [
                                "text",
                                "number",
                                "date",
                                "datetime",
                                "badge",
                                "link",
                                "markdown"
                            ],
                            "default": "text"
                        }
                    }
                },
                "columns": {
                    "type": "int",
                    "min": 1,
                    "max": 3,
                    "default": 2
                },
                "emptyText": {
                    "type": "string",
                    "maxLen": 200,
                    "default": "No record selected."
                }
            },
            "styleKnobs": [
                "span",
                "padding",
                "background",
                "radius",
                "border",
                "height"
            ],
            "defaultStyle": {
                "span": 12
            }
        },
        "button": {
            "label": "Button",
            "category": "Basics",
            "description": "A clickable button. Wire its onClick to an action; role \"submit\" submits the enclosing form.",
            "events": [
                "onClick"
            ],
            "props": {
                "label": {
                    "type": "string",
                    "required": true,
                    "maxLen": 80,
                    "default": "Button"
                },
                "variant": {
                    "type": "enum",
                    "values": [
                        "primary",
                        "secondary",
                        "ghost",
                        "danger"
                    ],
                    "default": "primary"
                },
                "iconLeft": {
                    "type": "icon",
                    "default": null
                },
                "role": {
                    "type": "enum",
                    "values": [
                        "button",
                        "submit"
                    ],
                    "default": "button"
                }
            },
            "styleKnobs": [
                "span",
                "size",
                "align"
            ],
            "defaultStyle": {
                "span": 3
            }
        },
        "callout": {
            "label": "Callout",
            "category": "Content",
            "description": "A highlighted note with a tone (info, success, warning, danger).",
            "props": {
                "title": {
                    "type": "string",
                    "maxLen": 120,
                    "default": null
                },
                "text": {
                    "type": "markdown",
                    "required": true,
                    "default": "Something worth highlighting."
                },
                "tone": {
                    "type": "enum",
                    "values": [
                        "info",
                        "success",
                        "warning",
                        "danger"
                    ],
                    "default": "info"
                }
            },
            "styleKnobs": [
                "span"
            ],
            "defaultStyle": {
                "span": 12
            }
        },
        "stat": {
            "label": "Stat",
            "category": "Data",
            "description": "A KPI tile: a label and a big value. The value can bind to an action result. v2 adds an optional delta/trend row.",
            "props": {
                "label": {
                    "type": "string",
                    "required": true,
                    "maxLen": 80,
                    "default": "Metric"
                },
                "value": {
                    "type": "binding",
                    "default": {
                        "kind": "static",
                        "value": "0"
                    }
                },
                "caption": {
                    "type": "string",
                    "maxLen": 120,
                    "default": null
                },
                "icon": {
                    "type": "icon",
                    "default": null
                },
                "delta": {
                    "type": "binding",
                    "default": {
                        "kind": "static",
                        "value": null
                    }
                },
                "deltaFormat": {
                    "type": "enum",
                    "values": [
                        "number",
                        "percent"
                    ],
                    "default": "number"
                },
                "trend": {
                    "type": "binding",
                    "default": {
                        "kind": "static",
                        "value": null
                    }
                },
                "positiveIsGood": {
                    "type": "boolean",
                    "default": true
                }
            },
            "styleKnobs": [
                "span",
                "size",
                "align",
                "color"
            ],
            "defaultStyle": {
                "span": 3
            }
        },
        "table": {
            "label": "Table",
            "category": "Data",
            "description": "A table over an array of objects â€” usually a routine result. Missing keys render as â€œâ€”â€.",
            "props": {
                "source": {
                    "type": "binding",
                    "default": {
                        "kind": "static",
                        "value": []
                    }
                },
                "columns": {
                    "type": "list",
                    "maxItems": 12,
                    "default": [],
                    "itemShape": {
                        "key": {
                            "type": "string",
                            "required": true,
                            "maxLen": 120
                        },
                        "label": {
                            "type": "string",
                            "maxLen": 120
                        },
                        "format": {
                            "type": "enum",
                            "values": [
                                "text",
                                "number",
                                "date",
                                "badge",
                                "link"
                            ],
                            "default": "text"
                        }
                    }
                },
                "emptyText": {
                    "type": "string",
                    "maxLen": 200,
                    "default": "Nothing to show yet."
                },
                "rowLimit": {
                    "type": "int",
                    "min": 1,
                    "max": 100,
                    "default": 25
                }
            },
            "styleKnobs": [
                "span",
                "size"
            ],
            "defaultStyle": {
                "span": 12
            }
        },
        "data_grid": {
            "label": "Data grid",
            "category": "Data",
            "description": "A powerful table over an array of objects: sortable/filterable columns, paging, selection, search and row actions.",
            "events": [
                "onRowClick",
                "onRowSelect"
            ],
            "props": {
                "source": {
                    "type": "binding",
                    "default": {
                        "kind": "static",
                        "value": []
                    }
                },
                "columns": {
                    "type": "list",
                    "maxItems": 20,
                    "default": [],
                    "itemShape": {
                        "key": {
                            "type": "string",
                            "required": true,
                            "maxLen": 120
                        },
                        "label": {
                            "type": "string",
                            "maxLen": 120
                        },
                        "format": {
                            "type": "enum",
                            "values": [
                                "text",
                                "number",
                                "date",
                                "badge",
                                "link",
                                "boolean",
                                "relation"
                            ],
                            "default": "text"
                        },
                        "width": {
                            "type": "int",
                            "min": 40,
                            "max": 800
                        },
                        "sortable": {
                            "type": "boolean"
                        },
                        "filterable": {
                            "type": "boolean"
                        },
                        "editable": {
                            "type": "boolean"
                        }
                    }
                },
                "pageSize": {
                    "type": "int",
                    "min": 5,
                    "max": 100,
                    "default": 25
                },
                "selectable": {
                    "type": "enum",
                    "values": [
                        "none",
                        "single",
                        "multi"
                    ],
                    "default": "none"
                },
                "searchable": {
                    "type": "boolean",
                    "default": false
                },
                "rowActions": {
                    "type": "list",
                    "maxItems": 8,
                    "default": [],
                    "itemShape": {
                        "label": {
                            "type": "string",
                            "required": true,
                            "maxLen": 80
                        },
                        "actionId": {
                            "type": "string",
                            "maxLen": 20
                        }
                    }
                },
                "density": {
                    "type": "enum",
                    "values": [
                        "compact",
                        "comfortable",
                        "spacious"
                    ],
                    "default": "comfortable"
                },
                "zebra": {
                    "type": "boolean",
                    "default": false
                },
                "emptyText": {
                    "type": "string",
                    "maxLen": 200,
                    "default": "Nothing to show yet."
                }
            },
            "styleKnobs": [
                "span",
                "size",
                "height"
            ],
            "defaultStyle": {
                "span": 12
            }
        },
        "chart": {
            "label": "Chart",
            "category": "Data",
            "description": "A bar/line/area/pie/donut chart over an array of objects. x-axis from xKey, one or more series by key.",
            "props": {
                "chartType": {
                    "type": "enum",
                    "values": [
                        "bar",
                        "line",
                        "area",
                        "pie",
                        "donut"
                    ],
                    "default": "bar"
                },
                "source": {
                    "type": "binding",
                    "default": {
                        "kind": "static",
                        "value": []
                    }
                },
                "title": {
                    "type": "string",
                    "maxLen": 120,
                    "default": null
                },
                "xKey": {
                    "type": "string",
                    "maxLen": 120,
                    "default": "label"
                },
                "series": {
                    "type": "list",
                    "maxItems": 12,
                    "default": [],
                    "itemShape": {
                        "key": {
                            "type": "string",
                            "required": true,
                            "maxLen": 120
                        },
                        "label": {
                            "type": "string",
                            "maxLen": 120
                        },
                        "color": {
                            "type": "string",
                            "maxLen": 40
                        }
                    }
                },
                "stacked": {
                    "type": "boolean",
                    "default": false
                },
                "showLegend": {
                    "type": "boolean",
                    "default": true
                },
                "showGrid": {
                    "type": "boolean",
                    "default": true
                },
                "valueFormat": {
                    "type": "enum",
                    "values": [
                        "number",
                        "percent",
                        "currency"
                    ],
                    "default": "number"
                }
            },
            "styleKnobs": [
                "span",
                "height"
            ],
            "defaultStyle": {
                "span": 6,
                "height": "md"
            }
        },
        "list": {
            "label": "List",
            "category": "Data",
            "description": "A card list over an array of objects â€” a friendlier alternative to a table, and the natural sidebar picker. badgeToneMap colours a status pill the way sideMap does for a message thread; timestampKey shows a short relative time; unreadKey bolds the row.",
            "props": {
                "source": {
                    "type": "binding",
                    "default": {
                        "kind": "static",
                        "value": []
                    }
                },
                "titleKey": {
                    "type": "string",
                    "maxLen": 120,
                    "default": "title"
                },
                "subtitleKey": {
                    "type": "string",
                    "maxLen": 120,
                    "default": null
                },
                "metaKey": {
                    "type": "string",
                    "maxLen": 120,
                    "default": null
                },
                "timestampKey": {
                    "type": "string",
                    "maxLen": 120,
                    "default": null
                },
                "badgeKey": {
                    "type": "string",
                    "maxLen": 120,
                    "default": null
                },
                "badgeToneMap": {
                    "type": "list",
                    "maxItems": 12,
                    "default": [],
                    "itemShape": {
                        "value": {
                            "type": "string",
                            "required": true,
                            "maxLen": 200
                        },
                        "label": {
                            "type": "string",
                            "maxLen": 80
                        },
                        "tone": {
                            "type": "enum",
                            "values": [
                                "primary",
                                "neutral",
                                "success",
                                "warning",
                                "danger",
                                "info"
                            ],
                            "default": "neutral"
                        }
                    }
                },
                "unreadKey": {
                    "type": "string",
                    "maxLen": 120,
                    "default": null
                },
                "selectedWhen": {
                    "type": "formula",
                    "default": null
                },
                "icon": {
                    "type": "icon",
                    "default": null
                },
                "emptyText": {
                    "type": "string",
                    "maxLen": 200,
                    "default": "Nothing to show yet."
                }
            },
            "events": [
                "onRowClick"
            ],
            "styleKnobs": [
                "span",
                "size",
                "height"
            ],
            "defaultStyle": {
                "span": 12
            }
        },
        "card": {
            "label": "Card",
            "category": "Layout",
            "description": "A surface that groups other components. Children lay out on the cardâ€™s own 12-column grid.",
            "container": true,
            "props": {
                "title": {
                    "type": "string",
                    "maxLen": 120,
                    "default": null
                },
                "description": {
                    "type": "string",
                    "maxLen": 300,
                    "default": null
                }
            },
            "styleKnobs": [
                "span",
                "padding",
                "gap",
                "radius",
                "background",
                "height",
                "border"
            ],
            "defaultStyle": {
                "span": 6,
                "padding": 3,
                "gap": 3,
                "background": "surface"
            }
        },
        "form": {
            "label": "Form",
            "category": "Input",
            "description": "Groups inputs and submits them to an action. Renders one built-in submit button; set showSubmit false for a form whose fields save on change.",
            "container": true,
            "events": [
                "onSubmit"
            ],
            "props": {
                "name": {
                    "type": "string",
                    "maxLen": 60,
                    "default": null
                },
                "submitLabel": {
                    "type": "string",
                    "maxLen": 80,
                    "default": "Submit"
                },
                "showReset": {
                    "type": "boolean",
                    "default": false
                },
                "showSubmit": {
                    "type": "boolean",
                    "default": true
                }
            },
            "styleKnobs": [
                "span",
                "gap",
                "padding"
            ],
            "defaultStyle": {
                "span": 6,
                "gap": 3,
                "padding": 0
            }
        },
        "input_text": {
            "label": "Text input",
            "category": "Input",
            "isInput": true,
            "description": "A single-line text field.",
            "props": {
                "name": {
                    "type": "string",
                    "required": true,
                    "maxLen": 60,
                    "default": "field"
                },
                "label": {
                    "type": "string",
                    "required": true,
                    "maxLen": 120,
                    "default": "Text"
                },
                "placeholder": {
                    "type": "string",
                    "maxLen": 200,
                    "default": null
                },
                "required": {
                    "type": "boolean",
                    "default": false
                },
                "defaultValue": {
                    "type": "string",
                    "maxLen": 1000,
                    "default": null
                },
                "inputType": {
                    "type": "enum",
                    "values": [
                        "text",
                        "email",
                        "url"
                    ],
                    "default": "text"
                },
                "valueFrom": {
                    "type": "binding",
                    "default": {
                        "kind": "static",
                        "value": null
                    }
                }
            },
            "styleKnobs": [
                "span",
                "size"
            ],
            "defaultStyle": {
                "span": 12
            }
        },
        "input_select": {
            "label": "Select",
            "category": "Input",
            "isInput": true,
            "description": "A dropdown with fixed options.",
            "events": [
                "onChange"
            ],
            "props": {
                "name": {
                    "type": "string",
                    "required": true,
                    "maxLen": 60,
                    "default": "choice"
                },
                "label": {
                    "type": "string",
                    "required": true,
                    "maxLen": 120,
                    "default": "Choice"
                },
                "options": {
                    "type": "list",
                    "maxItems": 100,
                    "default": [],
                    "itemShape": {
                        "value": {
                            "type": "string",
                            "required": true,
                            "maxLen": 200
                        },
                        "label": {
                            "type": "string",
                            "maxLen": 200
                        }
                    }
                },
                "required": {
                    "type": "boolean",
                    "default": false
                },
                "defaultValue": {
                    "type": "string",
                    "maxLen": 200,
                    "default": null
                },
                "placeholder": {
                    "type": "string",
                    "maxLen": 120,
                    "default": null
                },
                "valueFrom": {
                    "type": "binding",
                    "default": {
                        "kind": "static",
                        "value": null
                    }
                }
            },
            "styleKnobs": [
                "span",
                "size"
            ],
            "defaultStyle": {
                "span": 6
            }
        },
        "ai_chat": {
            "label": "AI chat",
            "category": "AI",
            "description": "A chat surface the app's viewers can talk to. Runs on the app OWNER's model tier (acts-as-owner) and can be grounded in the owner's knowledge bases. `mode:\"assistant\"` answers one question at a time instead of keeping a conversation.",
            "props": {
                "systemPrompt": {
                    "type": "string",
                    "maxLen": 4000,
                    "default": ""
                },
                "modelTier": {
                    "type": "string",
                    "maxLen": 60,
                    "default": "auto"
                },
                "knowledgeBaseIds": {
                    "type": "stringList",
                    "maxItems": 10,
                    "itemMaxLen": 80,
                    "default": []
                },
                "greeting": {
                    "type": "string",
                    "maxLen": 500,
                    "default": ""
                },
                "placeholder": {
                    "type": "string",
                    "maxLen": 120,
                    "default": "Ask a questionâ€¦"
                },
                "starters": {
                    "type": "stringList",
                    "maxItems": 6,
                    "itemMaxLen": 200,
                    "default": []
                },
                "mode": {
                    "type": "enum",
                    "values": [
                        "chat",
                        "assistant"
                    ],
                    "default": "chat"
                }
            },
            "styleKnobs": [
                "span",
                "height"
            ],
            "defaultStyle": {
                "span": 12
            }
        }
    },
    "events": [
        "onClick",
        "onSubmit",
        "onRowClick",
        "onRowSelect",
        "onCardMove",
        "onChange"
    ],
    "actions": {
        "kinds": [
            "run_automation",
            "ai_extract",
            "ai_generate",
            "kb_query",
            "send_email",
            "navigate",
            "toast",
            "open_url",
            "open_modal",
            "sequence"
        ],
        "specs": {
            "run_automation": {
                "fields": {
                    "automationId": {
                        "type": "string",
                        "nullable": true,
                        "required": true
                    },
                    "inputMapping": {
                        "type": "inputMapping",
                        "required": false
                    },
                    "onSuccess": {
                        "type": "effects",
                        "required": false
                    },
                    "onError": {
                        "type": "effects",
                        "required": false
                    }
                }
            },
            "ai_extract": {
                "fields": {
                    "source": {
                        "type": "binding",
                        "required": true
                    },
                    "schema": {
                        "type": "aiSchema",
                        "required": true
                    },
                    "modelTier": {
                        "type": "string",
                        "maxLen": 60
                    },
                    "knowledgeBaseIds": {
                        "type": "stringList"
                    },
                    "writeTo": {
                        "type": "aiWriteTo"
                    },
                    "resultVar": {
                        "type": "string",
                        "maxLen": 60
                    }
                }
            },
            "ai_generate": {
                "fields": {
                    "prompt": {
                        "type": "string",
                        "required": true,
                        "maxLen": 8000
                    },
                    "promptContext": {
                        "type": "binding"
                    },
                    "attachments": {
                        "type": "binding"
                    },
                    "output": {
                        "type": "enum",
                        "values": [
                            "text",
                            "structured"
                        ],
                        "default": "text"
                    },
                    "schema": {
                        "type": "aiSchema"
                    },
                    "modelTier": {
                        "type": "string",
                        "maxLen": 60
                    },
                    "knowledgeBaseIds": {
                        "type": "stringList"
                    },
                    "resultVar": {
                        "type": "string",
                        "required": true,
                        "maxLen": 60
                    }
                }
            },
            "kb_query": {
                "fields": {
                    "query": {
                        "type": "binding",
                        "required": true
                    },
                    "knowledgeBaseIds": {
                        "type": "stringList",
                        "required": true
                    },
                    "topK": {
                        "type": "int",
                        "min": 1,
                        "max": 20
                    },
                    "resultVar": {
                        "type": "string",
                        "required": true,
                        "maxLen": 60
                    }
                }
            },
            "send_email": {
                "fields": {
                    "connectorId": {
                        "type": "string",
                        "required": true
                    },
                    "to": {
                        "type": "binding"
                    },
                    "cc": {
                        "type": "binding"
                    },
                    "subject": {
                        "type": "binding"
                    },
                    "body": {
                        "type": "binding",
                        "required": true
                    },
                    "bodyFormat": {
                        "type": "enum",
                        "values": [
                            "markdown",
                            "text",
                            "html"
                        ],
                        "default": "markdown"
                    },
                    "replyToRecordId": {
                        "type": "binding"
                    },
                    "replyToThreadKey": {
                        "type": "binding"
                    },
                    "attachments": {
                        "type": "binding"
                    },
                    "recordOutbound": {
                        "type": "boolean",
                        "default": true
                    },
                    "resultVar": {
                        "type": "string",
                        "maxLen": 60
                    }
                }
            },
            "navigate": {
                "fields": {
                    "screenId": {
                        "type": "string",
                        "required": true
                    },
                    "params": {
                        "type": "navParams"
                    }
                }
            },
            "toast": {
                "fields": {
                    "message": {
                        "type": "string",
                        "required": true,
                        "maxLen": 500
                    },
                    "tone": {
                        "type": "enum",
                        "values": [
                            "info",
                            "success",
                            "warning",
                            "danger"
                        ],
                        "default": "info"
                    }
                }
            },
            "open_url": {
                "fields": {
                    "url": {
                        "type": "url",
                        "required": true
                    },
                    "newTab": {
                        "type": "boolean",
                        "default": true
                    }
                }
            },
            "open_modal": {
                "fields": {
                    "modalId": {
                        "type": "string",
                        "required": true
                    }
                }
            },
            "sequence": {
                "fields": {
                    "steps": {
                        "type": "steps",
                        "required": true
                    }
                }
            }
        },
        "toastTones": [
            "info",
            "success",
            "warning",
            "danger"
        ],
        "stepKinds": [
            "navigate",
            "toast",
            "open_url",
            "open_modal",
            "confirm",
            "set_variable",
            "refresh",
            "run_automation",
            "create_record",
            "update_record",
            "delete_record",
            "ai_extract",
            "ai_generate",
            "kb_query",
            "send_email",
            "condition",
            "loop",
            "switch"
        ],
        "stepSpecs": {
            "navigate": {
                "mutatesData": false,
                "fields": {
                    "screenId": {
                        "type": "string",
                        "required": true
                    },
                    "params": {
                        "type": "navParams"
                    }
                }
            },
            "toast": {
                "mutatesData": false,
                "fields": {
                    "message": {
                        "type": "string",
                        "required": true,
                        "maxLen": 500
                    },
                    "tone": {
                        "type": "enum",
                        "values": [
                            "info",
                            "success",
                            "warning",
                            "danger"
                        ],
                        "default": "info"
                    }
                }
            },
            "open_url": {
                "mutatesData": false,
                "fields": {
                    "url": {
                        "type": "url",
                        "required": true
                    },
                    "newTab": {
                        "type": "boolean",
                        "default": true
                    }
                }
            },
            "open_modal": {
                "mutatesData": false,
                "fields": {
                    "modalId": {
                        "type": "string",
                        "required": true
                    }
                }
            },
            "confirm": {
                "mutatesData": false,
                "fields": {
                    "message": {
                        "type": "string",
                        "required": true,
                        "maxLen": 500
                    },
                    "title": {
                        "type": "string",
                        "maxLen": 120
                    },
                    "confirmLabel": {
                        "type": "string",
                        "maxLen": 80
                    },
                    "cancelLabel": {
                        "type": "string",
                        "maxLen": 80
                    }
                }
            },
            "set_variable": {
                "mutatesData": false,
                "fields": {
                    "name": {
                        "type": "string",
                        "required": true,
                        "maxLen": 60
                    },
                    "value": {
                        "type": "binding",
                        "required": true
                    }
                }
            },
            "refresh": {
                "mutatesData": false,
                "fields": {
                    "tableId": {
                        "type": "string"
                    },
                    "datasetId": {
                        "type": "string"
                    },
                    "actionId": {
                        "type": "string"
                    }
                }
            },
            "run_automation": {
                "mutatesData": true,
                "fields": {
                    "automationId": {
                        "type": "string",
                        "nullable": true,
                        "required": true
                    },
                    "inputMapping": {
                        "type": "inputMapping"
                    },
                    "resultVar": {
                        "type": "string",
                        "maxLen": 60
                    }
                }
            },
            "create_record": {
                "mutatesData": true,
                "fields": {
                    "tableId": {
                        "type": "string",
                        "required": true
                    },
                    "values": {
                        "type": "recordValues",
                        "required": true
                    }
                }
            },
            "update_record": {
                "mutatesData": true,
                "fields": {
                    "tableId": {
                        "type": "string",
                        "required": true
                    },
                    "recordId": {
                        "type": "binding",
                        "required": true
                    },
                    "values": {
                        "type": "recordValues",
                        "required": true
                    },
                    "expectedUpdatedAt": {
                        "type": "binding"
                    }
                }
            },
            "delete_record": {
                "mutatesData": true,
                "fields": {
                    "tableId": {
                        "type": "string",
                        "required": true
                    },
                    "recordId": {
                        "type": "binding",
                        "required": true
                    }
                }
            },
            "ai_extract": {
                "mutatesData": true,
                "fields": {
                    "source": {
                        "type": "binding",
                        "required": true
                    },
                    "schema": {
                        "type": "aiSchema",
                        "required": true
                    },
                    "modelTier": {
                        "type": "string",
                        "maxLen": 60
                    },
                    "knowledgeBaseIds": {
                        "type": "stringList"
                    },
                    "writeTo": {
                        "type": "aiWriteTo"
                    },
                    "resultVar": {
                        "type": "string",
                        "maxLen": 60
                    }
                }
            },
            "ai_generate": {
                "mutatesData": true,
                "fields": {
                    "prompt": {
                        "type": "string",
                        "required": true,
                        "maxLen": 8000
                    },
                    "promptContext": {
                        "type": "binding"
                    },
                    "attachments": {
                        "type": "binding"
                    },
                    "output": {
                        "type": "enum",
                        "values": [
                            "text",
                            "structured"
                        ],
                        "default": "text"
                    },
                    "schema": {
                        "type": "aiSchema"
                    },
                    "modelTier": {
                        "type": "string",
                        "maxLen": 60
                    },
                    "knowledgeBaseIds": {
                        "type": "stringList"
                    },
                    "resultVar": {
                        "type": "string",
                        "required": true,
                        "maxLen": 60
                    }
                }
            },
            "kb_query": {
                "mutatesData": true,
                "fields": {
                    "query": {
                        "type": "binding",
                        "required": true
                    },
                    "knowledgeBaseIds": {
                        "type": "stringList",
                        "required": true
                    },
                    "topK": {
                        "type": "int",
                        "min": 1,
                        "max": 20
                    },
                    "resultVar": {
                        "type": "string",
                        "required": true,
                        "maxLen": 60
                    }
                }
            },
            "send_email": {
                "mutatesData": true,
                "fields": {
                    "connectorId": {
                        "type": "string",
                        "required": true
                    },
                    "to": {
                        "type": "binding"
                    },
                    "cc": {
                        "type": "binding"
                    },
                    "subject": {
                        "type": "binding"
                    },
                    "body": {
                        "type": "binding",
                        "required": true
                    },
                    "bodyFormat": {
                        "type": "enum",
                        "values": [
                            "markdown",
                            "text",
                            "html"
                        ],
                        "default": "markdown"
                    },
                    "replyToRecordId": {
                        "type": "binding"
                    },
                    "replyToThreadKey": {
                        "type": "binding"
                    },
                    "attachments": {
                        "type": "binding"
                    },
                    "recordOutbound": {
                        "type": "boolean",
                        "default": true
                    },
                    "resultVar": {
                        "type": "string",
                        "maxLen": 60
                    }
                }
            },
            "condition": {
                "mutatesData": false,
                "fields": {
                    "expr": {
                        "type": "formula",
                        "required": true
                    },
                    "then": {
                        "type": "steps",
                        "required": true
                    },
                    "else": {
                        "type": "steps"
                    }
                }
            },
            "loop": {
                "mutatesData": false,
                "fields": {
                    "source": {
                        "type": "binding",
                        "required": true
                    },
                    "itemVar": {
                        "type": "string",
                        "maxLen": 60
                    },
                    "indexVar": {
                        "type": "string",
                        "maxLen": 60
                    },
                    "maxIterations": {
                        "type": "int",
                        "min": 1,
                        "max": 200
                    },
                    "steps": {
                        "type": "steps",
                        "required": true
                    }
                }
            },
            "switch": {
                "mutatesData": false,
                "fields": {
                    "expr": {
                        "type": "formula",
                        "required": true
                    },
                    "cases": {
                        "type": "switchCases",
                        "required": true
                    },
                    "default": {
                        "type": "steps"
                    }
                }
            }
        },
        "clientStepKinds": [
            "navigate",
            "toast",
            "open_url",
            "open_modal",
            "confirm",
            "set_variable",
            "refresh",
            "condition",
            "loop",
            "switch"
        ],
        "dataMutatingStepKinds": [
            "run_automation",
            "create_record",
            "update_record",
            "delete_record",
            "ai_extract",
            "ai_generate",
            "kb_query",
            "send_email"
        ]
    },
    "bindings": {
        "kinds": [
            "static",
            "actionResult",
            "formula",
            "record",
            "records",
            "dataset",
            "connector",
            "aggregate"
        ],
        "inputMappingKinds": [
            "static",
            "field"
        ],
        "formulaScopeRoots": [
            "actions",
            "form",
            "forms",
            "screen",
            "vars",
            "item",
            "index",
            "value",
            "currentUser",
            "records",
            "datasets",
            "connectors",
            "now",
            "today"
        ]
    },
    "mailboxTables": {
        "message": {
            "name": "Messages",
            "icon": "mail",
            "fields": [
                {
                    "key": "provider_message_id",
                    "name": "Message id",
                    "type": "text",
                    "unique": true,
                    "required": true
                },
                {
                    "key": "thread_key",
                    "name": "Thread",
                    "type": "text"
                },
                {
                    "key": "provider_thread_id",
                    "name": "Provider thread id",
                    "type": "text"
                },
                {
                    "key": "rfc822_message_id",
                    "name": "RFC822 message id",
                    "type": "text"
                },
                {
                    "key": "in_reply_to",
                    "name": "In reply to",
                    "type": "text"
                },
                {
                    "key": "references",
                    "name": "References",
                    "type": "text"
                },
                {
                    "key": "direction",
                    "name": "Direction",
                    "type": "select",
                    "options": [
                        "inbound",
                        "outbound"
                    ]
                },
                {
                    "key": "from_email",
                    "name": "From",
                    "type": "text"
                },
                {
                    "key": "from_name",
                    "name": "From name",
                    "type": "text"
                },
                {
                    "key": "to_emails",
                    "name": "To",
                    "type": "text"
                },
                {
                    "key": "cc_emails",
                    "name": "Cc",
                    "type": "text"
                },
                {
                    "key": "subject",
                    "name": "Subject",
                    "type": "text"
                },
                {
                    "key": "subject_normalized",
                    "name": "Subject (normalised)",
                    "type": "text"
                },
                {
                    "key": "snippet",
                    "name": "Snippet",
                    "type": "text"
                },
                {
                    "key": "body_text",
                    "name": "Body",
                    "type": "richtext"
                },
                {
                    "key": "body_html",
                    "name": "Body (HTML)",
                    "type": "richtext"
                },
                {
                    "key": "received_at",
                    "name": "Received",
                    "type": "datetime"
                },
                {
                    "key": "is_read",
                    "name": "Read",
                    "type": "bool"
                },
                {
                    "key": "has_attachments",
                    "name": "Has attachments",
                    "type": "bool"
                },
                {
                    "key": "is_auto_or_bulk",
                    "name": "Auto/bulk",
                    "type": "bool"
                },
                {
                    "key": "labels",
                    "name": "Labels",
                    "type": "text"
                },
                {
                    "key": "mailbox_address",
                    "name": "Mailbox",
                    "type": "text"
                },
                {
                    "key": "provider",
                    "name": "Provider",
                    "type": "text"
                },
                {
                    "key": "raw_size",
                    "name": "Size",
                    "type": "number"
                }
            ]
        },
        "thread": {
            "name": "Conversations",
            "icon": "inbox",
            "fields": [
                {
                    "key": "thread_key",
                    "name": "Conversation",
                    "type": "text",
                    "unique": true,
                    "required": true
                },
                {
                    "key": "subject",
                    "name": "Subject",
                    "type": "text"
                },
                {
                    "key": "requester_email",
                    "name": "Customer",
                    "type": "text"
                },
                {
                    "key": "requester_name",
                    "name": "Customer name",
                    "type": "text"
                },
                {
                    "key": "last_message_at",
                    "name": "Last message",
                    "type": "datetime"
                },
                {
                    "key": "message_count",
                    "name": "Messages",
                    "type": "number"
                },
                {
                    "key": "has_unread",
                    "name": "Unread",
                    "type": "bool"
                },
                {
                    "key": "mailbox_address",
                    "name": "Mailbox",
                    "type": "text"
                },
                {
                    "key": "provider",
                    "name": "Provider",
                    "type": "text"
                }
            ]
        },
        "attachment": {
            "name": "Attachments",
            "icon": "paperclip",
            "fields": [
                {
                    "key": "provider_attachment_id",
                    "name": "Attachment id",
                    "type": "text",
                    "unique": true,
                    "required": true
                },
                {
                    "key": "provider_message_id",
                    "name": "Message id",
                    "type": "text"
                },
                {
                    "key": "filename",
                    "name": "Filename",
                    "type": "text"
                },
                {
                    "key": "mime_type",
                    "name": "Type",
                    "type": "text"
                },
                {
                    "key": "size",
                    "name": "Size",
                    "type": "number"
                },
                {
                    "key": "is_inline",
                    "name": "Inline",
                    "type": "bool"
                },
                {
                    "key": "file",
                    "name": "File",
                    "type": "file"
                }
            ]
        }
    }
};

