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
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
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

import React, { Component } from "react";
import { EuiFlexGroup, EuiFlexItem, EuiPagination, EuiSearchBar, ArgsWithError, ArgsWithQuery } from "@elastic/eui";
import EuiRefreshPicker from "../../../../temporary/EuiRefreshPicker";

interface IndexControlsProps {
  activePage: number;
  pageCount: number;
  search: string;
  onSearchChange: (args: ArgsWithQuery | ArgsWithError) => void;
  onPageClick: (page: number) => void;
  onRefresh: () => Promise<void>;
}

interface IndexControlsState {
  refreshInterval: number;
  isPaused: boolean;
}

const schema = {
  strict: true,
  fields: {
    indices: {
      type: "string",
    },
    data_streams: {
      type: "string",
    },
  },
};

const filters = [
  {
    type: "field_value_selection",
    field: "data_streams",
    name: "Data Streams",
    multiSelect: "or",
    // cache: 10000, // will cache the loaded tags for 10 sec
    options: [
      {
        value: "logs-redis",
      },
      {
        value: "logs-nginx",
      },
      {
        value: "logs-haproxy",
      },
      {
        value: "pollution",
      },
    ],
  },
];

export default class IndexControls extends Component<IndexControlsProps, IndexControlsState> {
  state: IndexControlsState = {
    refreshInterval: 0,
    isPaused: true,
  };

  onRefreshChange = ({ refreshInterval, isPaused }: IndexControlsState): void => {
    this.setState({ isPaused, refreshInterval });
  };

  render() {
    const { activePage, pageCount, search, onSearchChange, onPageClick, onRefresh } = this.props;
    const { refreshInterval, isPaused } = this.state;
    return (
      <EuiFlexGroup style={{ padding: "0px 5px" }}>
        <EuiFlexItem>
          <EuiSearchBar
            query={search}
            box={{ placeholder: "Search", schema, incremental: true }}
            onChange={onSearchChange}
            filters={filters}
          />
        </EuiFlexItem>
        <EuiFlexItem grow={false} style={{ maxWidth: 250 }}>
          <EuiRefreshPicker
            isPaused={isPaused}
            refreshInterval={refreshInterval}
            onRefreshChange={this.onRefreshChange}
            onRefresh={onRefresh}
          />
        </EuiFlexItem>
        {pageCount > 1 && (
          <EuiFlexItem grow={false} style={{ justifyContent: "center" }}>
            <EuiPagination
              pageCount={pageCount}
              activePage={activePage}
              onPageClick={onPageClick}
              data-test-subj="indexControlsPagination"
            />
          </EuiFlexItem>
        )}
      </EuiFlexGroup>
    );
  }
}
