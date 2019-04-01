import * as _ from 'lodash';
import * as Promise from 'bluebird';
import {
	sqlNameToODataName,
	odataNameToSqlName,
	Definition,
} from '@resin/odata-to-abstract-sql';
import TypedError = require('typed-error');
import * as sbvrUtils from './sbvr-utils';
import * as urlLib from 'url';
import {
	AbstractSqlModel,
	Relationship,
	ReferencedFieldNode,
	SelectNode,
	AliasNode,
} from '@resin/abstract-sql-compiler';
import { Request, Response } from 'express';
import { AnyObject } from './errors';

// const getResinApi = (
// 	req: sbvrUtils.PermissionReq & { tx?: Tx },
// 	custom?: AnyObject,
// ) => {
// 	const {
// 		resinApi,
// 	}: typeof _platform = require('@balena/open-balena-api/dist/platform');
// 	return resinApi.clone({
// 		passthrough: { req, tx: req.tx, custom },
// 	});
// };

const generateAllSynonyms = (
	tableName: string,
	synonyms: _.Dictionary<string>,
): string[] => {
	const result: string[] = [tableName];
	_.forEach(synonyms, (synonym, canonical) => {
		const split = tableName.split(synonym);
		const len = split.length;
		if (len === 1) {
			result.push(tableName);
			return;
		}
		// The total # of permutations is 2^len where len > 1, hence we iterate that many times
		_.times(2 ** len, n => {
			let s = split[0];
			for (var i = 1; i < len; i++) {
				var r = n % 2;
				n += r;
				n /= 2;
				s += (r ? synonym : canonical) + split[i];
			}
			if (s !== tableName) {
				// Avoid infinite recursion where we generated the same permutation as we had before
				result.push(...generateAllSynonyms(s, synonyms));
			}
		});
	});
	return result;
};

export const ReturnableError = class ReturnableError extends TypedError {};

export const generateAbstractSql = (seModel: string): AbstractSqlModel => {
	const lfModel = sbvrUtils.generateLfModel(seModel);
	return sbvrUtils.generateAbstractSqlModel(lfModel);
};

const resolveSynonym = (
	abstractSqlModel: AbstractSqlModel,
	resourceName: string,
) => {
	const sqlName = odataNameToSqlName(resourceName);
	return _(sqlName)
		.split('-')
		.map(resourceName => {
			const synonym = abstractSqlModel.synonyms[resourceName];
			if (synonym != null) {
				return synonym;
			}
			return resourceName;
		})
		.join('-');
};

export const resolveNavigationResource = (
	abstractSqlModel: AbstractSqlModel | undefined,
	resourceName: string,
	navigationName: string,
): string => {
	// If we don't have a model for the version then it should be an old one
	// where the navigation name *is* the resource name
	if (abstractSqlModel == null) {
		return navigationName;
	}

	const navigation = _(odataNameToSqlName(navigationName))
		.split('-')
		.flatMap(resourceName =>
			resolveSynonym(abstractSqlModel, resourceName).split('-'),
		)
		.concat('$')
		.value();
	const resolvedResourceName = resolveSynonym(abstractSqlModel, resourceName);
	const mapping = _.get(
		abstractSqlModel.relationships[resolvedResourceName],
		navigation,
	);
	if (mapping == null) {
		// If we don't have a mapping then the navigation name *is* the resource name
		return navigationName;
	}
	return sqlNameToODataName(abstractSqlModel.tables[mapping[1][0]].name);
};

const cloneCustom = (
	requestMappingFns: RewriteODataMappingFns,
	custom: AnyObject,
	abstractSqlModel: AbstractSqlModel | undefined,
	lambda: _.Dictionary<string>,
	resourceName: string,
	propertyName: string,
	v: AnyObject,
	optionName?: string,
) => {
	let newResource =
		lambda[propertyName] != null
			? lambda[propertyName]
			: resolveNavigationResource(abstractSqlModel, resourceName, propertyName);

	const newCustom = _.mapValues(custom, (v, k) => {
		if (k[0] === '$') {
			return v;
		}
		return _.cloneDeep(v);
	});
	if (optionName != null) {
		newCustom.$optionName = optionName;
	}

	if (requestMappingFns.start != null) {
		requestMappingFns.start(newResource, v, newCustom);
	}

	return { newCustom, newResource };
};

export interface RewriteODataMappingFns {
	start?: (resourceName: string, v: AnyObject, custom: AnyObject) => void;
	resource: (
		resourceName: string,
		field: ODataField,
		k: number,
		data: any[],
		custom: AnyObject,
	) => true | void;
	empty?: () => void;
}

export const rewriteODataOptions = (
	requestMappingFns: RewriteODataMappingFns,
	resource: string,
	data: AnyObject | any[],
	custom: AnyObject,
	abstractSqlModel?: AbstractSqlModel,
	lambda: _.Dictionary<string> = {},
) => {
	const deletes: number[] = [];
	_.each(data, (v: any, k: string | number) => {
		if (_.isArray(v)) {
			rewriteODataOptions(
				requestMappingFns,
				resource,
				v,
				custom,
				abstractSqlModel,
				lambda,
			);
		} else if (_.isObject(v)) {
			const propertyName = v.name;
			if (propertyName != null) {
				if (
					lambda[propertyName] == null &&
					requestMappingFns.resource(
						resource,
						v,
						k as number,
						data as any[],
						custom,
					) === true
				) {
					deletes.push(k as number);
					// We can skip recursing if we're gonna delete it anyway
					return;
				}

				if (v.lambda != null) {
					const newLambda = _.clone(lambda);
					newLambda[v.lambda.identifier] = resolveNavigationResource(
						abstractSqlModel,
						resource,
						propertyName,
					);
					// TODO: This should use the top level resource context, but odata-to-abstract-sql
					// is bugged so we use the lambda context in order to match the bug
					const { newCustom, newResource } = cloneCustom(
						requestMappingFns,
						custom,
						abstractSqlModel,
						lambda,
						resource,
						propertyName,
						v,
					);
					rewriteODataOptions(
						requestMappingFns,
						newResource,
						v,
						newCustom,
						abstractSqlModel,
						newLambda,
					);
				} else if (v.options != null) {
					_.each(v.options, (option, optionName) => {
						const { newCustom, newResource } = cloneCustom(
							requestMappingFns,
							custom,
							abstractSqlModel,
							lambda,
							resource,
							propertyName,
							v,
							optionName,
						);
						rewriteODataOptions(
							requestMappingFns,
							newResource,
							option,
							newCustom,
							abstractSqlModel,
							lambda,
						);
					});
				} else if (v.property != null) {
					const { newCustom, newResource } = cloneCustom(
						requestMappingFns,
						custom,
						abstractSqlModel,
						lambda,
						resource,
						propertyName,
						v,
					);
					rewriteODataOptions(
						requestMappingFns,
						newResource,
						v,
						newCustom,
						abstractSqlModel,
						lambda,
					);
				} else {
					rewriteODataOptions(
						requestMappingFns,
						resource,
						v,
						custom,
						abstractSqlModel,
						lambda,
					);
				}
			} else if (v.args != null) {
				rewriteODataOptions(
					requestMappingFns,
					resource,
					v.args,
					custom,
					abstractSqlModel,
					lambda,
				);
			} else {
				rewriteODataOptions(
					requestMappingFns,
					resource,
					v,
					custom,
					abstractSqlModel,
					lambda,
				);
			}
		}
	});
	if (deletes.length > 0) {
		if (_.isArray(data)) {
			for (let i = deletes.length - 1; i >= 0; i--) {
				data.splice(deletes[i], 1);
			}
		} else {
			// If we're trying to delete something from a non-array it means
			// you're trying to access something you have no permission to,
			// this will work in a much nicer way when moved to the sql layer
			throw new sbvrUtils.PermissionError();
		}
		if (data.length === 0 && requestMappingFns.empty != null) {
			requestMappingFns.empty();
		}
	}
};

// interface TranslateResponseFn {
// 	(req: Request, body: any): Promise<any> | any;
// }
// const translateResponse = (
// 	req: Request,
// 	res: Response,
// 	fn: TranslateResponseFn,
// ): void => {
// 	const originalJson = res.json;
// 	res.json = function() {
// 		let body: any;
// 		let statusCode: number | undefined;
// 		if (arguments.length === 1) {
// 			[body] = arguments;
// 		} else if (_.isNumber(arguments[1])) {
// 			[body, statusCode] = arguments;
// 		} else {
// 			[statusCode, body] = arguments;
// 		}
// 		return (Promise.try(() => fn(req, body))
// 			.then(body => {
// 				if (statusCode != null) {
// 					return originalJson.call(res, statusCode, body);
// 				} else {
// 					return originalJson.call(res, body);
// 				}
// 			})
// 			.catch(err => {
// 				return res.send(500);
// 			}) as any) as Response;
// 	};
// };

// const rewriteMappings = <
// 	X,
// 	F extends (mapping: Exclude<T, Function>) => X,
// 	T,
// 	$
// >(
// 	resourceMappings: undefined | Mapping<T | X, $>,
// 	cb: F,
// ): Mapping<X, $> =>
// 	_.mapValues(resourceMappings, (resourceMapping, key) => {
// 		if (key[0] === '$') {
// 			return resourceMapping as $;
// 		}
// 		return _.mapValues(
// 			resourceMapping as Dictionary<T | X>,
// 			(mapping): X => {
// 				if (_.isFunction(mapping)) {
// 					return mapping as X;
// 				}
// 				return cb(mapping as Exclude<T, Function>);
// 			},
// 		);
// 	});

interface Mapping<T, SetupFn = never> {
	$?: SetupFn;
	[resourceName: string]:
		| {
				[fieldName: string]: T;
		  }
		| SetupFn
		| undefined;
}

interface ODataField {
	name: string;
	lambda?: {};
	options?: {
		$select?: { properties: Array<{ name: string }> } | '*';
	};
	property: {};
}
export interface RequestCallback {
	(field: ODataField, k: number, data: any[], custom: AnyObject): void;
}
export interface RequestBodyCallback {
	(
		body: AnyObject,
		key: string,
		custom: { $req: sbvrUtils.HookReq; [key: string]: any },
	): void;
}
export interface ResponseBodyCallback {
	(
		value: any,
		key: string,
		data: AnyObject,
		custom: { [key: string]: any },
	): string;
}

type MappingSetupFnResult = undefined | false | AnyObject;

export type RequestBodyMappingSetupFn = (args: {
	req: Request;
	res: Response;
}) => MappingSetupFnResult | Promise<MappingSetupFnResult>;
export type RequestBodyMappings = Mapping<
	RequestBodyCallback | string,
	RequestBodyMappingSetupFn
>;

export const getResourceName = (req: Request) => {
	const match = /^[a-zA-Z_]*/.exec(req.params[0]);
	if (match == null) {
		throw new Error('Could not match resource');
	}
	return match[0];
};

// const sqlResponseBodyMappings = Promise.method(
// 	(req: sbvrUtils.HookReq, resourceName: string, body: AnyObject) => {
// 		if (req.method !== 'POST') {
// 			return body;
// 		}
// 		if (body == null || body.id == null) {
// 			return body;
// 		}
// 		if (Object.keys(body).length === 1) {
// 			// Don't try to translate if only the id was returned, we either don't have permissions
// 			// or they requested that only the id be returned
// 			return body;
// 		}
// 		return getResinApi(req, { applyVersions: req.custom!.applyVersions }).get({
// 			resource: resourceName,
// 			id: body.id,
// 		});
// 	},
// );

// const memoizedGetOData2AbstractSQL = memoizeWeak(
// 	(abstractSqlModel: AbstractSqlModel) => {
// 		return new OData2AbstractSQL(abstractSqlModel);
// 	},
// );

// const createMemoizedOdata2AbstractSQL = () => {
// 	const $memoizedOdata2AbstractSQL = memoizeWeak(
// 		(
// 			odata2AbstractSQL: OData2AbstractSQL,
// 			odataQuery: sbvrUtils.HookRequest['odataQuery'],
// 			method: SupportedMethod,
// 			bodyKeys: string[],
// 			existingBindVarsLength: number,
// 		) => {
// 			try {
// 				const abstractSql = odata2AbstractSQL.match(
// 					odataQuery,
// 					method,
// 					bodyKeys,
// 					existingBindVarsLength,
// 				);
// 				deepFreeze(abstractSql);
// 				return abstractSql;
// 			} catch (e) {
// 				if (e instanceof sbvrUtils.PermissionError) {
// 					throw e;
// 				}
// 				console.error(
// 					'Failed to translate url: ',
// 					JSON.stringify(odataQuery, null, '\t'),
// 					method,
// 					e,
// 				);
// 				throw new sbvrUtils.TranslationError('Failed to translate url');
// 			}
// 		},
// 		{
// 			normalizer: (_odata2AbstractSQL, args) => JSON.stringify(args),
// 			max: 1000,
// 		},
// 	);
// 	return (
// 		$request: RequiredField<sbvrUtils.HookRequest, 'abstractSqlModel'>,
// 	) => {
// 		const odata2AbstractSQL = memoizedGetOData2AbstractSQL(
// 			$request.abstractSqlModel,
// 		);
// 		const { tree, extraBodyVars, extraBindVars } = $memoizedOdata2AbstractSQL(
// 			odata2AbstractSQL,
// 			$request.odataQuery,
// 			$request.method,
// 			// Sort the body keys to improve cache hits
// 			_.keys($request.values).sort(),
// 			$request.odataBinds.length,
// 		);
// 		_.assign($request.values, extraBodyVars);
// 		$request.odataBinds.push(...extraBindVars);

// 		return tree;
// 	};
// };

export const aliasFields = (
	abstractSqlModel: AbstractSqlModel,
	resourceName: string,
	aliases: _.Dictionary<string | ReferencedFieldNode>,
): SelectNode[1] => {
	const fieldNames = abstractSqlModel.tables[resourceName].fields.map(
		({ fieldName }) => fieldName,
	);
	const nonexistentFields = _.difference(Object.keys(aliases), fieldNames, [
		'$toResource',
	]);
	if (nonexistentFields.length > 0) {
		throw new Error(
			`Tried to alias non-existent fields: '${nonexistentFields.join(', ')}'`,
		);
	}
	return fieldNames.map((fieldName):
		| AliasNode<ReferencedFieldNode>
		| ReferencedFieldNode => {
		const alias = aliases[fieldName];
		if (alias) {
			if (_.isString(alias)) {
				return ['Alias', ['ReferencedField', resourceName, alias], fieldName];
			}
			return ['Alias', alias, fieldName];
		}
		return ['ReferencedField', resourceName, fieldName];
	});
};

const aliasResource = (
	abstractSqlModel: AbstractSqlModel,
	resourceName: string,
	toResource: string,
	aliases: _.Dictionary<string | ReferencedFieldNode>,
): Definition => {
	if (!abstractSqlModel.tables[toResource]) {
		throw new Error(`Tried to alias to a non-existent resource: ${toResource}`);
	}
	return {
		extraBinds: [],
		abstractSqlQuery: [
			'SelectQuery',
			['Select', aliasFields(abstractSqlModel, resourceName, aliases)],
			['From', ['Alias', ['Resource', toResource], resourceName]],
		],
	} as Definition;
};

// const getAbstractSqlQueryGenerator = (abstractSqlModel: AbstractSqlModel) => {
// 	const memoizedOdata2AbstractSQL = createMemoizedOdata2AbstractSQL();
// 	return ($req: sbvrUtils.HookReq, $request: sbvrUtils.HookRequest) => {
// 		if ($req.method !== 'GET' || $request.abstractSqlQuery != null) {
// 			return;
// 		}
// 		const req: sbvrUtils.PermissionReq = {
// 			apiKey: _.cloneDeep($req.apiKey),
// 		};
// 		if ($req.user != null) {
// 			// We only do the `_.pick` if `$req.user` exists as otherwise it converts `undefined` to `{}`
// 			req.user = _.cloneDeep(
// 				_.pick($req.user, 'id', 'actor', 'permissions'),
// 			) as sbvrUtils.User;
// 		}

// 		// This hack is so that abstractSqlQuery is non-null, which means we bypass permissions correctly - realistically we need the translations to be built in and ordered correctly
// 		$request.abstractSqlQuery = [] as any;

// 		// And then we manually add permissions to guarantee ordering, using the v3 model so that relations can be traversed properly
// 		$request.abstractSqlModel = abstractSqlModel;
// 		return permissions.addPermissions(req, $request).then(() => {
// 			$request.abstractSqlQuery = memoizedOdata2AbstractSQL(
// 				$request as RequiredField<sbvrUtils.HookRequest, 'abstractSqlModel'>,
// 			);
// 		});
// 	};
// };

// TODO: This should use `sbvrUtils.getAffectedIds` but we need built in translations for that
export const getUrlAffectedIds = (url: string, api: sbvrUtils.PinejsClient) => {
	const parsedUrl = urlLib.parse(url, true);

	// we have to null this to make `urlLib#format` tolerate the params we change below
	parsedUrl.path = undefined;
	parsedUrl.search = undefined;

	// strip the URL prefix because api prepends it automatically
	const path = parsedUrl.pathname;
	if (path == null) {
		throw new Error('Could not determine api prefix');
	}
	const match = path.match(/^\/[^\/]+\//);
	if (match == null) {
		throw new Error('Could not determine api prefix');
	}
	const apiPrefix = match[0];
	parsedUrl.pathname = path.substring(apiPrefix.length);

	if (parsedUrl.query == null) {
		parsedUrl.query = {};
	}
	parsedUrl.query.$select = 'id';

	// In OData the $ of $filter etc must be unescaped
	// Also an escaped / in a resource name says it is part of the name,
	// eg "user%2Fusername" is "user/username", not "user"/"username"
	// And : for %3a eg. resource/any(d:d/id eq 1)
	url = urlLib
		.format(parsedUrl)
		.replace(/%24/g, '$')
		.replace(/%2f/gi, '/')
		.replace(/%3a/gi, ':');

	return api
		.get(url)
		.then((data: AnyObject[]) => _.map(data, ({ id }) => id as number));
};

export const translateUrl = (
	req: Request,
	version: string,
	resource: string,
	filter?: string,
	id?: number,
) => {
	const withId = id ? `(${id})` : '';
	const withFilter = filter ? `?${filter}` : '';
	req.url = `/${version}/${resource}${withId}${withFilter}`;
	req.params[0] = resource;
};

// export const fixFilterOfTranslatedResources = (
// 	req: Request,
// 	res: Response,
// 	resourceName: string,
// 	version: string,
// ): Promise<number[]> => {
// 	if (!_.includes(['PATCH', 'PUT', 'DELETE'], req.method)) {
// 		return Promise.resolve([]);
// 	}

// 	// We have to grab the url here before a `doRename` potentially changes it
// 	const { url } = req;
// 	return runRequest(req, res)
// 		.then(api => {
// 			const versionedApi = api.clone({
// 				passthrough: _.merge({}, api.passthrough, {
// 					custom: {
// 						applyVersions: req.custom!.applyVersions,
// 					},
// 				}),
// 			});

// 			return getUrlAffectedIds(url, versionedApi);
// 		})
// 		.then(envvarIds => {
// 			if (envvarIds.length === 0) {
// 				req.url = `/${version}/${resourceName}?$filter=1 eq 0`;
// 			} else {
// 				req.url = `/${version}/${resourceName}?$filter=id in (${envvarIds})`;
// 			}
// 			return envvarIds;
// 		});
// };

export const renameField = (
	abstractSqlModel: AbstractSqlModel,
	resourceName: string,
	path: string[],
	from: string,
	to: string,
) => {
	_.forEach(abstractSqlModel.tables[resourceName].fields, field => {
		if (field.fieldName === from) {
			field.fieldName = to;
		}
	});

	const relationship = abstractSqlModel.relationships[resourceName];

	const orig = _.get(relationship, path);
	orig[to] = orig[from];
	delete orig[from];

	_.set(relationship, to, _.get(relationship, from));
	delete relationship[from];
	_.set(relationship, [to, '$'], [to]);
};

const namespaceRelationships = (
	relationships: Relationship,
	alias: string,
): void => {
	_.forEach(relationships, (relationship: Relationship, key) => {
		if (key === '$') {
			return;
		}

		let mapping = relationship.$;
		if (mapping != null && mapping.length === 2) {
			mapping = _.cloneDeep(mapping);
			if (!key.includes('$')) {
				mapping[1][0] = `${mapping[1][0]}$${alias}`;
				relationships[`${key}$${alias}`] = {
					$: mapping,
				};
				delete relationships[key];
			}
		}
		namespaceRelationships(relationship, alias);
	});
};

export const translateAbstractSqlModel = (
	fromAbstractSqlModel: AbstractSqlModel,
	toAbstractSqlModel: AbstractSqlModel,
	fromVersion: string,
	toVersion: string,
	definitions: _.Dictionary<
		Definition | _.Dictionary<string | ReferencedFieldNode>
	> = {},
): void => {
	fromAbstractSqlModel.rules = toAbstractSqlModel.rules;

	const fromKeys = Object.keys(fromAbstractSqlModel.tables);
	const nonexistentTables = _.difference(Object.keys(definitions), fromKeys);
	if (nonexistentTables.length > 0) {
		throw new Error(
			`Tried to define non-existent resources: '${nonexistentTables.join(
				', ',
			)}'`,
		);
	}
	_.each(toAbstractSqlModel.synonyms, (canonicalForm, synonym) => {
		// Don't double alias
		if (synonym.includes('$')) {
			fromAbstractSqlModel.synonyms[synonym] = canonicalForm;
		} else {
			fromAbstractSqlModel.synonyms[
				`${synonym}$${toVersion}`
			] = `${canonicalForm}$${toVersion}`;
		}
	});
	const relationships = _.cloneDeep(toAbstractSqlModel.relationships);
	namespaceRelationships(relationships as Relationship, toVersion);
	_.each(relationships, (relationship, key) => {
		// Don't double alias
		if (!key.includes('$')) {
			key = `${key}$${toVersion}`;
		}
		fromAbstractSqlModel.relationships[key] = relationship;
	});
	_.each(toAbstractSqlModel.tables, (table, key) => {
		// Don't double alias
		if (!key.includes('$')) {
			key = `${key}$${toVersion}`;
		}
		fromAbstractSqlModel.tables[key] = _.cloneDeep(table);
	});
	// _.each(toAbstractSqlModel.tables, (table, key) => {
	// 	// Don't double alias
	// 	if (!key.includes('$')) {
	// 		key = `${key}$${toVersion}`;
	// 	}
	// 	fromAbstractSqlModel.tables[key] = _.cloneDeep(table);
	// 	(table as any).modifyFields = _.cloneDeep(table.fields)
	// });
	// _.each(toAbstractSqlModel.tables, (table, origKey) => {
	// 	let key = origKey
	// 	// Don't double alias
	// 	if (!key.includes('$')) {
	// 		key = `${key}$${toVersion}`;
	// 	}
	// 	fromAbstractSqlModel.tables[key] = table
	// 	fromAbstractSqlModel.tables[origKey] = _.cloneDeep(table);
	// 	(fromAbstractSqlModel.tables[origKey] as any).modifyFields = _.cloneDeep(table.fields);
	// });
	_.each(fromKeys, key => {
		const definition = definitions[key];
		const table = fromAbstractSqlModel.tables[key];
		if (definition) {
			const toResource = _.isString((definition as any).$toResource)
				? (definition as any).$toResource
				: `${key}$${toVersion}`;
			const toTable = fromAbstractSqlModel.tables[toResource];
			(table as any).modifyFields = _.cloneDeep(
				(toTable as any).modifyFields
					? (toTable as any).modifyFields
					: toTable.fields,
			);
			if ('extraBinds' in definition && 'abstractSqlQuery' in definition) {
				table.definition = definition as Definition;
			} else {
				table.definition = aliasResource(
					fromAbstractSqlModel,
					key,
					toResource,
					definition,
				);
			}
		} else {
			const toTable = fromAbstractSqlModel.tables[`${key}$${toVersion}`];
			(table as any).modifyFields = _.cloneDeep(
				(toTable as any).modifyFields
					? (toTable as any).modifyFields
					: toTable.fields,
			);
			table.definition = {
				extraBinds: [],
				abstractSqlQuery: ['Resource', `${key}$${toVersion}`],
			};
		}
		// Also alias the current version so it can be explicitly referenced
		fromAbstractSqlModel.tables[`${key}$${fromVersion}`] = _.clone(table);
	});
};

export type RequestMappingSetupFn = (args: {
	req: sbvrUtils.HookReq;
	request: sbvrUtils.HookRequest;
}) => MappingSetupFnResult;
export type RequestMappings = Mapping<
	RequestCallback | string,
	RequestMappingSetupFn
>;

export type ResponseBodyMappingSetupFn = (args: {
	req: Request;
	resourceName: string;
	body: AnyObject;
}) => MappingSetupFnResult | Promise<MappingSetupFnResult>;
export type ResponseBodyMappings = Mapping<
	ResponseBodyCallback | string,
	ResponseBodyMappingSetupFn
>;
