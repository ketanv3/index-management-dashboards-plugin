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
import React from "react";
import { EuiSteps } from "@elastic/eui";

interface CreateRollupStepsProps {
  step: number;
}

const setOfSteps = (step: number) => {
  return [
    {
      title: "Set up indices",
      children: <></>,
    },
    {
      title: "Define aggregations and metrics",
      children: <></>,
      status: step < 2 ? "disabled" : null,
    },
    {
      title: "Specify schedule",
      children: <></>,
      status: step < 3 ? "disabled" : null,
    },
    {
      title: "Review and create",
      children: <></>,
      status: step < 4 ? "disabled" : null,
    },
  ];
};
const CreateRollupSteps = ({ step }: CreateRollupStepsProps) => (
  <div style={{ paddingLeft: "10px" }}>
    <EuiSteps steps={setOfSteps(step)} headingElement="h6" />
  </div>
);

export default CreateRollupSteps;
