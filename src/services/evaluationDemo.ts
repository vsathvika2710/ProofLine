import { INITIAL_AUDIT_LOGS, INITIAL_REVIEW_TASKS, SCENARIOS } from '../data/mockData';
import type { AuditLogEntry, ReviewTask, ScenarioDataset } from '../types';

export const EVALUATION_DEMO_ORGANIZATION = 'NovaWear Demo';
export const EVALUATION_DEMO_SCENARIO_ID = 'smartwatch';

const demoText = (value: string) => value.replace(/NovaTech(?: Wearables)?/g, 'NovaWear');

export function createEvaluationDemoScenario(): ScenarioDataset {
  const scenario = SCENARIOS[EVALUATION_DEMO_SCENARIO_ID];
  return {
    ...scenario,
    brand: 'NovaWear',
    name: demoText(scenario.name),
    description: demoText(scenario.description),
    tagline: demoText(scenario.tagline),
    facts: scenario.facts.map((fact) => ({
      ...fact,
      name: demoText(fact.name),
      currentValue: demoText(fact.currentValue),
      previousValue: fact.previousValue ? demoText(fact.previousValue) : undefined,
      owner: demoText(fact.owner),
      sourceDocName: demoText(fact.sourceDocName),
      sourcePassage: demoText(fact.sourcePassage),
      tags: [...fact.tags],
    })),
    documents: scenario.documents.map((document) => ({
      ...document,
      title: demoText(document.title),
      owner: demoText(document.owner),
      summary: demoText(document.summary),
      sections: document.sections.map((section) => ({ ...section, text: demoText(section.text) })),
    })),
    assets: scenario.assets.map((asset) => ({
      ...asset,
      title: demoText(asset.title),
      content: demoText(asset.content),
      channel: demoText(asset.channel),
      assignedReviewer: demoText(asset.assignedReviewer),
      linkedFactIds: [...asset.linkedFactIds],
    })),
    sampleTexts: scenario.sampleTexts.map((sample) => ({
      ...sample,
      title: demoText(sample.title),
      text: demoText(sample.text),
      type: demoText(sample.type),
    })),
  };
}

export function createEvaluationDemoReviewTasks(): ReviewTask[] {
  return INITIAL_REVIEW_TASKS.map((task) => ({
    ...task,
    assetTitle: demoText(task.assetTitle),
    originalText: demoText(task.originalText),
    suggestedText: demoText(task.suggestedText),
    currentText: demoText(task.currentText),
    notes: task.notes ? demoText(task.notes) : undefined,
    auditTrail: task.auditTrail.map((event) => ({
      ...event,
      by: demoText(event.by),
      note: event.note ? demoText(event.note) : undefined,
    })),
  }));
}

export function createEvaluationDemoAuditLogs(): AuditLogEntry[] {
  return INITIAL_AUDIT_LOGS.map((entry) => ({
    ...entry,
    actor: demoText(entry.actor),
    role: demoText(entry.role),
    target: demoText(entry.target),
    details: demoText(entry.details),
  }));
}
