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
import "@testing-library/jest-dom/extend-expect";
import { render, waitFor } from "@testing-library/react";
// @ts-ignore
import userEvent from "@testing-library/user-event";
import { Redirect, Route, RouteComponentProps, Switch } from "react-router-dom";
import { MemoryRouter as Router } from "react-router-dom";
import { browserServicesMock, coreServicesMock } from "../../../../../test/mocks";
import Policies from "./Policies";
import { TEXT } from "../../components/PolicyEmptyPrompt/PolicyEmptyPrompt";
import { ModalProvider, ModalRoot } from "../../../../components/Modal";
import { ServicesConsumer, ServicesContext } from "../../../../services";
import { BREADCRUMBS, ROUTES } from "../../../../utils/constants";
import { BrowserServices } from "../../../../models/interfaces";
import { CoreServicesContext } from "../../../../components/core_services";

// TODO: Move common renderWith or with___ helpers into top level tests directory
function renderPoliciesWithRouter() {
  return {
    ...render(
      <Router>
        <CoreServicesContext.Provider value={coreServicesMock}>
          <ServicesContext.Provider value={browserServicesMock}>
            <ServicesConsumer>
              {(services: BrowserServices | null) =>
                services && (
                  <ModalProvider>
                    <ModalRoot services={services} />
                    <Switch>
                      <Route
                        path={ROUTES.INDEX_POLICIES}
                        render={(props: RouteComponentProps) => (
                          <div style={{ padding: "25px 25px" }}>
                            <Policies {...props} policyService={services.policyService} />
                          </div>
                        )}
                      />
                      <Route path={ROUTES.CREATE_POLICY} render={(props) => <div>Testing create policy</div>} />
                      <Route path={ROUTES.EDIT_POLICY} render={(props) => <div>Testing edit policy: {props.location.search}</div>} />
                      <Redirect from="/" to={ROUTES.INDEX_POLICIES} />
                    </Switch>
                  </ModalProvider>
                )
              }
            </ServicesConsumer>
          </ServicesContext.Provider>
        </CoreServicesContext.Provider>
      </Router>
    ),
  };
}

// TODO: generate random policy (w/ seed for snapshots)
const testPolicy = {
  id: "some_policy_id",
  primaryTerm: 1,
  seqNo: 5,
  policy: {
    policy: {
      description: "some policy description",
      states: [
        {
          name: "some_state",
          actions: [{ delete: {} }],
          transitions: [],
        },
      ],
    },
  },
};

describe("<IndexPolicies /> spec", () => {
  it("renders the component", async () => {
    browserServicesMock.policyService.getPolicies = jest.fn().mockResolvedValue({
      ok: true,
      response: { policies: [], totalPolicies: 0 },
    });
    const { container } = renderPoliciesWithRouter();

    expect(container.firstChild).toMatchSnapshot();
  });

  it("shows LOADING on mount", async () => {
    browserServicesMock.policyService.getPolicies = jest.fn().mockResolvedValue({
      ok: true,
      response: { policies: [], totalPolicies: 0 },
    });
    const { getByText } = renderPoliciesWithRouter();

    getByText(TEXT.LOADING);
  });

  it("sets breadcrumbs when mounting", async () => {
    browserServicesMock.policyService.getPolicies = jest.fn().mockResolvedValue({
      ok: true,
      response: { policies: [], totalPolicies: 0 },
    });
    renderPoliciesWithRouter();

    expect(coreServicesMock.chrome.setBreadcrumbs).toHaveBeenCalledTimes(1);
    expect(coreServicesMock.chrome.setBreadcrumbs).toHaveBeenCalledWith([BREADCRUMBS.INDEX_MANAGEMENT, BREADCRUMBS.INDEX_POLICIES]);
  });

  it("loads policies", async () => {
    const policies = [testPolicy];
    browserServicesMock.policyService.getPolicies = jest.fn().mockResolvedValue({
      ok: true,
      response: { policies, totalPolicies: 1 },
    });
    const { getByText } = renderPoliciesWithRouter();
    await waitFor(() => {});

    await waitFor(() => getByText(testPolicy.id));
  });

  it("adds error toaster when get policies has error", async () => {
    browserServicesMock.policyService.getPolicies = jest.fn().mockResolvedValue({ ok: false, error: "some error" });
    renderPoliciesWithRouter();

    await waitFor(() => {});

    expect(coreServicesMock.notifications.toasts.addDanger).toHaveBeenCalledTimes(1);
    expect(coreServicesMock.notifications.toasts.addDanger).toHaveBeenCalledWith("some error");
  });

  it("adds error toaster when get policies throws error", async () => {
    browserServicesMock.policyService.getPolicies = jest.fn().mockRejectedValue(new Error("rejected error"));
    renderPoliciesWithRouter();

    await waitFor(() => {});

    expect(coreServicesMock.notifications.toasts.addDanger).toHaveBeenCalledTimes(1);
    expect(coreServicesMock.notifications.toasts.addDanger).toHaveBeenCalledWith("rejected error");
  });

  it("can delete a policy", async () => {
    const policies = [testPolicy];
    browserServicesMock.policyService.getPolicies = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, response: { policies, totalPolicies: 1 } })
      .mockResolvedValueOnce({ ok: true, response: { policies: [], totalPolicies: 0 } });
    browserServicesMock.policyService.deletePolicy = jest.fn().mockResolvedValue({ ok: true, response: true });
    const { queryByText, getByText, getByTestId } = renderPoliciesWithRouter();

    await waitFor(() => getByText(testPolicy.id));

    expect(getByTestId("DeleteButton")).toBeDisabled();

    userEvent.click(getByTestId(`checkboxSelectRow-${testPolicy.id}`));

    expect(getByTestId("DeleteButton")).toBeEnabled();

    userEvent.click(getByTestId("DeleteButton"));
    await waitFor(() => getByTestId("confirmationModalActionButton"));
    userEvent.click(getByTestId("confirmationModalActionButton"));

    await waitFor(() => {});

    expect(browserServicesMock.policyService.deletePolicy).toHaveBeenCalledTimes(1);
    expect(coreServicesMock.notifications.toasts.addSuccess).toHaveBeenCalledTimes(1);
    expect(coreServicesMock.notifications.toasts.addSuccess).toHaveBeenCalledWith(`Deleted the policy: ${testPolicy.id}`);

    await waitFor(() => expect(queryByText(testPolicy.id)).toBeNull());
  });

  it("can route to edit policy", async () => {
    const policies = [testPolicy];
    browserServicesMock.policyService.getPolicies = jest.fn().mockResolvedValue({
      ok: true,
      response: { policies, totalPolicies: 1 },
    });
    const { getByText, getByTestId } = renderPoliciesWithRouter();

    await waitFor(() => getByText(testPolicy.id));

    expect(getByTestId("EditButton")).toBeDisabled();

    userEvent.click(getByTestId(`checkboxSelectRow-${testPolicy.id}`));

    expect(getByTestId("EditButton")).toBeEnabled();

    userEvent.click(getByTestId("EditButton"));

    await waitFor(() => getByText(`Testing edit policy: ?id=${testPolicy.id}`));
  });

  it("can route to create policy", async () => {
    browserServicesMock.policyService.getPolicies = jest.fn().mockResolvedValue({
      ok: true,
      response: { policies: [], totalPolicies: 1 },
    });
    const { getByText, getByTestId } = renderPoliciesWithRouter();

    await waitFor(() => {});

    userEvent.click(getByTestId("Create policyButton"));

    await waitFor(() => getByText("Testing create policy"));
  });

  it("can open and close a policy in modal", async () => {
    const policies = [testPolicy];
    browserServicesMock.policyService.getPolicies = jest.fn().mockResolvedValue({
      ok: true,
      response: { policies, totalPolicies: 1 },
    });
    const { getByText, queryByText, getByTestId } = renderPoliciesWithRouter();

    await waitFor(() => getByText(testPolicy.id));

    userEvent.click(getByText(testPolicy.id));

    // asserts that the policy description showed up in modal as the
    // whole JSON is broken up between span elements
    await waitFor(() => getByText(`"${testPolicy.policy.policy.description}"`));

    userEvent.click(getByTestId("policyModalCloseButton"));

    expect(queryByText(`"${testPolicy.policy.policy.description}"`)).toBeNull();
  });

  it("can go to edit a policy from modal", async () => {
    const policies = [testPolicy];
    browserServicesMock.policyService.getPolicies = jest.fn().mockResolvedValue({
      ok: true,
      response: { policies, totalPolicies: 1 },
    });
    const { getByText, getByTestId } = renderPoliciesWithRouter();

    await waitFor(() => getByText(testPolicy.id));
    userEvent.click(getByText(testPolicy.id));
    await waitFor(() => getByTestId("policyModalEditButton"));
    userEvent.click(getByTestId("policyModalEditButton"));

    await waitFor(() => getByText(`Testing edit policy: ?id=${testPolicy.id}`));
  });

  it("sorts/paginates the table", async () => {
    const policies = new Array(40).fill(null).map((_, index) => ({
      ...testPolicy,
      id: `some_policy_id_${index}`,
      // last_updated_time is effectively adding 1 to every policy so we can assert on the sort
      policy: { policy: { ...testPolicy.policy.policy, last_updated_time: Date.now() + index } },
    }));
    browserServicesMock.policyService.getPolicies = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, response: { policies: policies.slice(0, 20), totalPolicies: 40 } })
      .mockResolvedValueOnce({ ok: true, response: { policies: policies.slice(20), totalPolicies: 40 } })
      .mockResolvedValueOnce({
        ok: true,
        response: {
          policies: policies
            .slice()
            .sort((a, b) => a.policy.policy.last_updated_time - b.policy.policy.last_updated_time)
            .slice(0, 20),
          totalPolicies: 40,
        },
      });

    const { getByText, getByTestId, getAllByTestId, queryByText } = renderPoliciesWithRouter();

    // should load policies 0-19 on first load
    await waitFor(() => getByText("some_policy_id_0"));
    expect(queryByText("some_policy_id_39")).toBeNull();

    userEvent.click(getAllByTestId("pagination-button-next")[0]);

    // should load policies 20-39 after clicking next
    await waitFor(() => getByText("some_policy_id_39"));
    expect(queryByText("some_policy_id_0")).toBeNull();

    // @ts-ignore
    userEvent.click(getByTestId("tableHeaderCell_policy.last_updated_time_2").firstChild);

    // should load policies 0-19  after clicking sort (defaults to asc) on last_updated_time
    await waitFor(() => getByText("some_policy_id_0"));
    expect(queryByText("some_policy_id_39")).toBeNull();
  });
});
