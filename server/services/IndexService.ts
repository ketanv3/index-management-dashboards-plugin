/*
 * SPDX-License-Identifier: Apache-2.0
 *
 * The OpenSearch Contributors require contributions made to
 * this file be licensed under the Apache-2.0 license or a
 * compatible open source license.
 *
 * Modifications Copyright OpenSearch Contributors. See
 * GitHub history for details.
 */

/*
 * Copyright 2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License").
 * You may not use this file except in compliance with the License.
 * A copy of the License is located at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * or in the "license" file accompanying this file. This file is distributed
 * on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 * express or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */

import { Setting } from "../utils/constants";
import {
  AcknowledgedResponse,
  ApplyPolicyResponse,
  AddResponse,
  CatIndex,
  GetIndicesResponse,
  ExplainResponse,
  ExplainAPIManagedIndexMetaData,
} from "../models/interfaces";
import { ServerResponse } from "../models/types";
import {
  OpenSearchDashboardsRequest,
  OpenSearchDashboardsResponseFactory,
  ILegacyCustomClusterClient,
  IOpenSearchDashboardsResponse,
  RequestHandlerContext,
} from "../../../../src/core/server";
import { getIndexToDataStreamMapping } from "../utils/helpers";

export default class IndexService {
  osDriver: ILegacyCustomClusterClient;

  constructor(osDriver: ILegacyCustomClusterClient) {
    this.osDriver = osDriver;
  }

  getIndices = async (
    context: RequestHandlerContext,
    request: OpenSearchDashboardsRequest,
    response: OpenSearchDashboardsResponseFactory
  ): Promise<IOpenSearchDashboardsResponse<ServerResponse<GetIndicesResponse>>> => {
    try {
      // @ts-ignore
      const { from, size, sortField, sortDirection, terms, indices, dataStreams } = request.query as {
        from: string;
        size: string;
        sortField: string;
        sortDirection: string;
        terms?: string[];
        indices?: string[];
        dataStreams?: string[];
      };

      // Terms are searched with a wildcard around them.
      const searchTerms = terms ? `*${[terms].flat().join("*,*")}*` : "";

      // Indices and data streams are searched with an exact match.
      const searchIndices = indices ? [indices].flat().join(",") : "";
      const searchDataStreams = dataStreams ? [dataStreams].flat().join(",") : "";

      // The overall search string is a combination of terms, indices, and data streams.
      // If the search string is blank, then '*' is used to match everything.
      const searchString = [searchTerms, searchIndices, searchDataStreams].filter((value) => value !== "").join(",") || "*";

      const params = {
        index: searchString,
        format: "json",
        s: `${sortField}:${sortDirection}`,
        expand_wildcards: "all",
      };
      const { callAsCurrentUser: callWithRequest } = this.osDriver.asScoped(request);
      const indicesResponse: CatIndex[] = await callWithRequest("cat.indices", params);

      // _cat doesn't support pagination, do our own in server pagination to at least reduce network bandwidth
      const fromNumber = parseInt(from, 10);
      const sizeNumber = parseInt(size, 10);
      const paginatedIndices = indicesResponse.slice(fromNumber, fromNumber + sizeNumber);
      const indexNames = paginatedIndices.map((value: CatIndex) => value.index);

      const [managedStatus, indexToDataStreamMapping] = await Promise.all([
        this._getManagedStatus(request, indexNames),
        getIndexToDataStreamMapping(this.osDriver.asScoped(request)),
      ]);

      // NOTE: Cannot use response.ok due to typescript type checking
      return response.custom({
        statusCode: 200,
        body: {
          ok: true,
          response: {
            indices: paginatedIndices.map((catIndex: CatIndex) => ({
              ...catIndex,
              managed: managedStatus[catIndex.index] || "N/A",
              data_stream: indexToDataStreamMapping[catIndex.index] || null,
            })),
            totalIndices: indicesResponse.length,
          },
        },
      });
    } catch (err) {
      // Throws an error if there is no index matching pattern
      if (err.statusCode === 404 && err.body.error.type === "index_not_found_exception") {
        return response.custom({
          statusCode: 200,
          body: {
            ok: true,
            response: {
              indices: [],
              totalIndices: 0,
            },
          },
        });
      }
      console.error("Index Management - IndexService - getIndices:", err);
      return response.custom({
        statusCode: 200,
        body: {
          ok: false,
          error: err.message,
        },
      });
    }
  };

  _getManagedStatus = async (request: OpenSearchDashboardsRequest, indexNames: string[]): Promise<{ [indexName: string]: string }> => {
    try {
      const explainParamas = { index: indexNames.toString() };
      const { callAsCurrentUser: callWithRequest } = this.osDriver.asScoped(request);
      const explainResponse: ExplainResponse = await callWithRequest("ism.explain", explainParamas);

      const managed: { [indexName: string]: string } = {};
      for (const indexName in explainResponse) {
        if (indexName === "total_managed_indices") continue;
        const explain = explainResponse[indexName] as ExplainAPIManagedIndexMetaData;
        managed[indexName] = explain["index.plugins.index_state_management.policy_id"] === null ? "No" : "Yes";
      }

      return managed;
    } catch (err) {
      // otherwise it could be an unauthorized access error to config index or some other error
      // in which case we will return managed status N/A
      console.error("Index Management - IndexService - _getManagedStatus:", err);
      return indexNames.reduce((accu, value) => ({ ...accu, [value]: "N/A" }), {});
    }
  };

  applyPolicy = async (
    context: RequestHandlerContext,
    request: OpenSearchDashboardsRequest,
    response: OpenSearchDashboardsResponseFactory
  ): Promise<IOpenSearchDashboardsResponse<ServerResponse<ApplyPolicyResponse>>> => {
    try {
      const { indices, policyId } = request.body as { indices: string[]; policyId: string };
      const { callAsCurrentUser: callWithRequest } = this.osDriver.asScoped(request);
      const params = { index: indices.join(","), body: { policy_id: policyId } };

      const addResponse: AddResponse = await callWithRequest("ism.add", params);
      return response.custom({
        statusCode: 200,
        body: {
          ok: true,
          response: {
            failures: addResponse.failures,
            updatedIndices: addResponse.updated_indices,
            failedIndices: addResponse.failed_indices.map((failedIndex) => ({
              indexName: failedIndex.index_name,
              indexUuid: failedIndex.index_uuid,
              reason: failedIndex.reason,
            })),
          },
        },
      });
    } catch (err) {
      console.error("Index Management - IndexService - applyPolicy:", err);
      // return { ok: false, error: err.message };
      return response.custom({
        statusCode: 200,
        body: {
          ok: false,
          error: err.message,
        },
      });
    }
  };

  editRolloverAlias = async (
    context: RequestHandlerContext,
    request: OpenSearchDashboardsRequest,
    response: OpenSearchDashboardsResponseFactory
  ): Promise<IOpenSearchDashboardsResponse<ServerResponse<AcknowledgedResponse>>> => {
    try {
      const { alias, index } = request.body as { alias: string; index: string };
      const { callAsCurrentUser: callWithRequest } = this.osDriver.asScoped(request);
      const params = { index, body: { [Setting.RolloverAlias]: alias } };
      const rollOverResponse = await callWithRequest("indices.putSettings", params);
      return response.custom({
        statusCode: 200,
        body: {
          ok: true,
          response: rollOverResponse,
        },
      });
    } catch (err) {
      console.error("Index Management - IndexService - editRolloverAlias", err);
      return response.custom({
        statusCode: 200,
        body: {
          ok: false,
          error: err.message,
        },
      });
    }
  };
}
