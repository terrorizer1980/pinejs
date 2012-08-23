define(["ometa-core"], (function() {
    var comparisons = ({
        "Equals": " = ",
        "GreaterThanOrEqual": " >= ",
        "NotEquals": " != "
    });
    var AbstractSQLRules2SQL = OMeta._extend({
        "NestedIndent": function(indent) {
            var $elf = this,
                _fromIdx = this.input.idx;
            return (indent + "\t")
        },
        "Not": function(indent) {
            var notStatement, nestedIndent, ruleBody, $elf = this,
                _fromIdx = this.input.idx;
            this._form((function() {
                this._applyWithArgs("exactly", "Not");
                return notStatement = this._or((function() {
                    ruleBody = this._applyWithArgs("Exists", indent);
                    return ("NOT " + ruleBody)
                }), (function() {
                    nestedIndent = this._applyWithArgs("NestedIndent", indent);
                    ruleBody = this._applyWithArgs("RuleBody", nestedIndent);
                    return (((("NOT (" + nestedIndent) + ruleBody) + indent) + ")")
                }))
            }));
            return notStatement
        },
        "Exists": function(indent) {
            var nestedIndent, ruleBody, $elf = this,
                _fromIdx = this.input.idx;
            this._form((function() {
                this._applyWithArgs("exactly", "Exists");
                nestedIndent = this._applyWithArgs("NestedIndent", indent);
                return ruleBody = this._applyWithArgs("SelectQuery", nestedIndent)
            }));
            return (((("EXISTS (" + nestedIndent) + ruleBody) + indent) + ")")
        },
        "ProcessQuery": function() {
            var $elf = this,
                query, _fromIdx = this.input.idx;
            return this._or((function() {
                query = this._or((function() {
                    return this._applyWithArgs("SelectQuery", "\n")
                }), (function() {
                    return this._applyWithArgs("InsertQuery", "\n")
                }), (function() {
                    return this._applyWithArgs("UpdateQuery", "\n")
                }), (function() {
                    return this._applyWithArgs("DeleteQuery", "\n")
                }));
                return ({
                    "query": query,
                    "bindings": this["fieldOrderings"]
                })
            }), (function() {
                return this._applyWithArgs("UpsertQuery", "\n")
            }))
        },
        "SelectQuery": function(indent) {
            var table, nestedIndent, fields, $elf = this,
                where, _fromIdx = this.input.idx,
                tables, orderBy;
            nestedIndent = this._applyWithArgs("NestedIndent", indent);
            tables = [];
            this._form((function() {
                this._applyWithArgs("exactly", "SelectQuery");
                return this._many((function() {
                    return this._form((function() {
                        return this._or((function() {
                            return fields = this._apply("Select")
                        }), (function() {
                            table = this._apply("Table");
                            return tables.push(table)
                        }), (function() {
                            where = this._applyWithArgs("Where", indent);
                            return where = ((indent + "WHERE ") + where)
                        }), (function() {
                            orderBy = this._applyWithArgs("OrderBy", indent);
                            return orderBy = ((indent + "ORDER BY ") + orderBy)
                        }))
                    }))
                }))
            }));
            return (((((("SELECT " + fields.join(", ")) + indent) + "FROM ") + tables.join(("," + nestedIndent))) + ((where != null) ? where : "")) + ((orderBy != null) ? orderBy : ""))
        },
        "DeleteQuery": function(indent) {
            var table, $elf = this,
                where, _fromIdx = this.input.idx,
                tables;
            tables = [];
            this._form((function() {
                this._applyWithArgs("exactly", "DeleteQuery");
                return this._many((function() {
                    return this._form((function() {
                        return this._or((function() {
                            table = this._apply("Table");
                            return tables.push(table)
                        }), (function() {
                            where = this._applyWithArgs("Where", indent);
                            return where = ((indent + "WHERE ") + where)
                        }))
                    }))
                }))
            }));
            return ((("DELETE FROM " + tables.join(", ")) + indent) + ((where != null) ? where : ""))
        },
        "InsertBody": function(indent) {
            var table, $elf = this,
                _fromIdx = this.input.idx,
                fieldValues, tables;
            tables = [];
            this._many((function() {
                return this._form((function() {
                    return this._or((function() {
                        return fieldValues = this._apply("Fields")
                    }), (function() {
                        table = this._apply("Table");
                        return tables.push(table)
                    }), (function() {
                        return (function() {
                            switch (this._apply('anything')) {
                            case "Where":
                                return this._many((function() {
                                    return this._apply("anything")
                                }));
                            default:
                                throw this._fail()
                            }
                        }).call(this)
                    }))
                }))
            }));
            return (((((((("INSERT INTO " + tables.join(", ")) + " (") + fieldValues[(0)].join(", ")) + ")") + indent) + " VALUES (") + fieldValues[(1)].join(", ")) + ")")
        },
        "UpdateBody": function(indent) {
            var table, sets, $elf = this,
                where, _fromIdx = this.input.idx,
                fieldValues, tables;
            tables = [];
            this._many((function() {
                return this._form((function() {
                    return this._or((function() {
                        return fieldValues = this._apply("Fields")
                    }), (function() {
                        table = this._apply("Table");
                        return tables.push(table)
                    }), (function() {
                        where = this._applyWithArgs("Where", indent);
                        return where = ((indent + "WHERE ") + where)
                    }))
                }))
            }));
            sets = [];
            (function() {
                for (var i = (0);
                (i < fieldValues[(0)]["length"]); i++) {
                    (sets[i] = ((fieldValues[(0)][i] + " = ") + fieldValues[(1)][i]))
                }
            }).call(this);
            return ((((("UPDATE " + tables.join(", ")) + indent) + " SET ") + sets.join(("," + indent))) + ((where != null) ? where : ""))
        },
        "UpsertQuery": function(indent) {
            var $elf = this,
                insert, _fromIdx = this.input.idx,
                tables, update;
            tables = [];
            this._form((function() {
                this._applyWithArgs("exactly", "UpsertQuery");
                insert = this._lookahead((function() {
                    return this._applyWithArgs("InsertBody", indent)
                }));
                insert = ({
                    "query": insert,
                    "bindings": this["fieldOrderings"]
                });
                (this["fieldOrderings"] = []);
                update = this._applyWithArgs("UpdateBody", indent);
                return update = ({
                    "query": update,
                    "bindings": this["fieldOrderings"]
                })
            }));
            return [insert, update]
        },
        "InsertQuery": function(indent) {
            var $elf = this,
                insert, _fromIdx = this.input.idx;
            this._form((function() {
                this._applyWithArgs("exactly", "InsertQuery");
                return insert = this._applyWithArgs("InsertBody", indent)
            }));
            return insert
        },
        "UpdateQuery": function(indent) {
            var $elf = this,
                _fromIdx = this.input.idx,
                update;
            this._form((function() {
                this._applyWithArgs("exactly", "UpdateQuery");
                return update = this._applyWithArgs("UpdateBody", indent)
            }));
            return update
        },
        "Null": function() {
            var $elf = this,
                next, _fromIdx = this.input.idx;
            next = this._apply("anything");
            this._pred((next === null));
            return null
        },
        "Fields": function() {
            var value, fields, $elf = this,
                _fromIdx = this.input.idx,
                field, values;
            this._applyWithArgs("exactly", "Fields");
            fields = [];
            values = [];
            this._form((function() {
                return this._many1((function() {
                    return this._form((function() {
                        field = this._apply("anything");
                        fields.push((("\"" + field) + "\""));
                        value = this._or((function() {
                            return (function() {
                                switch (this._apply('anything')) {
                                case "?":
                                    return "?";
                                default:
                                    throw this._fail()
                                }
                            }).call(this)
                        }), (function() {
                            this._apply("true");
                            return (1)
                        }), (function() {
                            this._apply("false");
                            return (0)
                        }), (function() {
                            this._apply("Null");
                            return "NULL"
                        }), (function() {
                            return this._apply("Bind")
                        }), (function() {
                            value = this._apply("anything");
                            return (("'" + value) + "'")
                        }));
                        return values.push(value)
                    }))
                }))
            }));
            return [fields, values]
        },
        "Select": function() {
            var fields, $elf = this,
                _fromIdx = this.input.idx,
                field, as;
            this._applyWithArgs("exactly", "Select");
            fields = [];
            this._form((function() {
                return this._or((function() {
                    this._apply("end");
                    return fields.push("1")
                }), (function() {
                    return this._many((function() {
                        return this._or((function() {
                            return this._form((function() {
                                field = this._or((function() {
                                    return (function() {
                                        switch (this._apply('anything')) {
                                        case "Count":
                                            return (function() {
                                                this._applyWithArgs("exactly", "*");
                                                return "COUNT(*)"
                                            }).call(this);
                                        default:
                                            throw this._fail()
                                        }
                                    }).call(this)
                                }), (function() {
                                    field = this._or((function() {
                                        return this._apply("Field")
                                    }), (function() {
                                        return this._apply("ReferencedField")
                                    }));
                                    as = this._apply("anything");
                                    return (((field + " AS \"") + as) + "\"")
                                }));
                                return fields.push(field)
                            }))
                        }), (function() {
                            return (function() {
                                switch (this._apply('anything')) {
                                case "*":
                                    return fields.push("*");
                                default:
                                    throw this._fail()
                                }
                            }).call(this)
                        }), (function() {
                            this._apply("Null");
                            return fields.push("NULL")
                        }), (function() {
                            field = this._apply("anything");
                            return fields.push((("\"" + field) + "\""))
                        }))
                    }))
                }))
            }));
            return fields
        },
        "Table": function() {
            var table, $elf = this,
                _fromIdx = this.input.idx,
                alias;
            this._applyWithArgs("exactly", "From");
            table = this._apply("anything");
            alias = [];
            this._opt((function() {
                alias = this._apply("anything");
                return alias = [(("\"" + alias) + "\"")]
            }));
            return [(("\"" + table) + "\"")].concat(alias).join(" AS ")
        },
        "Where": function(indent) {
            var $elf = this,
                _fromIdx = this.input.idx;
            this._applyWithArgs("exactly", "Where");
            return this._applyWithArgs("RuleBody", indent)
        },
        "OrderBy": function(indent) {
            var order, $elf = this,
                _fromIdx = this.input.idx,
                field, orders;
            this._applyWithArgs("exactly", "OrderBy");
            orders = [];
            this._many1((function() {
                return this._form((function() {
                    order = (function() {
                        switch (this._apply('anything')) {
                        case "ASC":
                            return "ASC";
                        case "DESC":
                            return "DESC";
                        default:
                            throw this._fail()
                        }
                    }).call(this);
                    field = this._apply("Field");
                    return orders.push(((field + " ") + order))
                }))
            }));
            return orders.join(", ")
        },
        "Field": function() {
            var $elf = this,
                _fromIdx = this.input.idx,
                field;
            this._form((function() {
                this._applyWithArgs("exactly", "Field");
                return field = this._apply("anything")
            }));
            return (("\"" + field) + "\"")
        },
        "ReferencedField": function() {
            var $elf = this,
                binding, _fromIdx = this.input.idx,
                field;
            this._form((function() {
                this._applyWithArgs("exactly", "ReferencedField");
                binding = this._apply("anything");
                return field = this._apply("anything")
            }));
            return (((("\"" + binding) + "\".\"") + field) + "\"")
        },
        "Number": function() {
            var number, $elf = this,
                _fromIdx = this.input.idx;
            this._form((function() {
                this._applyWithArgs("exactly", "Number");
                return number = this._apply("anything")
            }));
            return number
        },
        "Boolean": function() {
            var $elf = this,
                bool, _fromIdx = this.input.idx;
            this._form((function() {
                this._applyWithArgs("exactly", "Boolean");
                return bool = this._or((function() {
                    this._apply("true");
                    return (1)
                }), (function() {
                    this._apply("false");
                    return (2)
                }))
            }));
            return bool
        },
        "Bind": function() {
            var tableName, $elf = this,
                _fromIdx = this.input.idx,
                field;
            this._form((function() {
                this._applyWithArgs("exactly", "Bind");
                tableName = this._apply("anything");
                return field = this._apply("anything")
            }));
            this["fieldOrderings"].push([tableName, field]);
            return "?"
        },
        "Value": function() {
            var value, $elf = this,
                _fromIdx = this.input.idx;
            this._form((function() {
                this._applyWithArgs("exactly", "Value");
                return value = this._apply("anything")
            }));
            return (("'" + value) + "'")
        },
        "And": function(indent) {
            var ruleBodies, $elf = this,
                _fromIdx = this.input.idx;
            this._form((function() {
                this._applyWithArgs("exactly", "And");
                return ruleBodies = this._many((function() {
                    return this._applyWithArgs("RuleBody", indent)
                }))
            }));
            return ruleBodies.join(" AND ")
        },
        "Comparison": function(indent) {
            var comparison, $elf = this,
                a, b, _fromIdx = this.input.idx;
            this._form((function() {
                comparison = (function() {
                    switch (this._apply('anything')) {
                    case "NotEquals":
                        return "NotEquals";
                    case "Equals":
                        return "Equals";
                    case "GreaterThanOrEqual":
                        return "GreaterThanOrEqual";
                    default:
                        throw this._fail()
                    }
                }).call(this);
                a = this._applyWithArgs("RuleBody", indent);
                return b = this._applyWithArgs("RuleBody", indent)
            }));
            return ((a + comparisons[comparison]) + b)
        },
        "Between": function(indent) {
            var $elf = this,
                a, b, _fromIdx = this.input.idx,
                val;
            this._form((function() {
                this._applyWithArgs("exactly", "Between");
                val = this._applyWithArgs("Comparator", indent);
                a = this._applyWithArgs("Comparator", indent);
                return b = this._applyWithArgs("Comparator", indent)
            }));
            return ((((val + " BETWEEN ") + a) + " AND ") + b)
        },
        "Comparator": function(indent) {
            var nestedIndent, $elf = this,
                query, _fromIdx = this.input.idx;
            return this._or((function() {
                nestedIndent = this._applyWithArgs("NestedIndent", indent);
                query = this._applyWithArgs("SelectQuery", nestedIndent);
                return (((("(" + nestedIndent) + query) + indent) + ")")
            }), (function() {
                return this._apply("Field")
            }), (function() {
                return this._apply("ReferencedField")
            }), (function() {
                return this._apply("Number")
            }), (function() {
                return this._apply("Boolean")
            }), (function() {
                return this._apply("Value")
            }), (function() {
                return this._apply("Bind")
            }))
        },
        "RuleBody": function(indent) {
            var $elf = this,
                _fromIdx = this.input.idx;
            return this._or((function() {
                return this._applyWithArgs("Comparator", indent)
            }), (function() {
                return this._applyWithArgs("Not", indent)
            }), (function() {
                return this._applyWithArgs("Exists", indent)
            }), (function() {
                return this._applyWithArgs("Comparison", indent)
            }), (function() {
                return this._applyWithArgs("Between", indent)
            }), (function() {
                return this._applyWithArgs("And", indent)
            }))
        },
        "Process": function() {
            var ruleBody, $elf = this,
                _fromIdx = this.input.idx;
            ruleBody = this._applyWithArgs("RuleBody", "\n");
            return (("SELECT " + ruleBody) + " AS \"result\";")
        }
    });
    (AbstractSQLRules2SQL["initialize"] = (function() {
        (this["fieldOrderings"] = [])
    }));
    return AbstractSQLRules2SQL
}))