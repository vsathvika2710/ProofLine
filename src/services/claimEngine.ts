import { Claim, Fact, ContentAsset, ChangeImpactResult } from '../types';

export function analyzeContent(text: string, facts: Fact[]): {
  claims: Claim[];
  overallScore: number;
  stats: {
    total: number;
    supported: number;
    contradicted: number;
    outdated: number;
    unsupported: number;
    toneIssue: number;
  };
} {
  const claims: Claim[] = [];
  const lower = text.toLowerCase();

  // 1. Warranty Check
  const warrantyFact = facts.find((f) => f.code === 'FACT-WTY-01' || f.name.toLowerCase().includes('warranty'));
  if (warrantyFact) {
    // Check for outdated 2-year warranty
    const twoYearMatch = text.match(/(?:2[\s-]year|two[\s-]year|two years of coverage|2-year warranty)/i);
    if (twoYearMatch) {
      const isOutdated = warrantyFact.currentValue.includes('1 year');
      claims.push({
        id: 'CLM-WTY-01',
        text: twoYearMatch[0],
        category: 'policy_terms',
        status: isOutdated ? 'outdated' : 'supported',
        confidence: 96,
        matchedFactId: warrantyFact.id,
        matchedFactName: warrantyFact.name,
        expectedValue: warrantyFact.currentValue,
        foundValue: twoYearMatch[0],
        sourceCitation: {
          documentName: warrantyFact.sourceDocName,
          passage: warrantyFact.sourcePassage,
          version: warrantyFact.version,
        },
        explanation: isOutdated
          ? `Outdated claim detected: Warranty Policy v3.2 updated hardware coverage from 2 years to 1 year effective Nov 1, 2026. Prior 2-year claims must be revised before publishing.`
          : `Claim matches active approved policy.`,
        suggestedCorrection: isOutdated ? '1-year limited warranty' : twoYearMatch[0],
      });
    }

    // Check for correct 1-year warranty
    const oneYearMatch = text.match(/(?:1[\s-]year|one[\s-]year|1 year limited manufacturer warranty)/i);
    if (oneYearMatch && !twoYearMatch) {
      claims.push({
        id: 'CLM-WTY-02',
        text: oneYearMatch[0],
        category: 'policy_terms',
        status: 'supported',
        confidence: 98,
        matchedFactId: warrantyFact.id,
        matchedFactName: warrantyFact.name,
        expectedValue: warrantyFact.currentValue,
        foundValue: oneYearMatch[0],
        sourceCitation: {
          documentName: warrantyFact.sourceDocName,
          passage: warrantyFact.sourcePassage,
          version: warrantyFact.version,
        },
        explanation: 'Verified: Matches approved Warranty Policy v3.2 Section 4.1.',
        suggestedCorrection: oneYearMatch[0],
      });
    }
  }

  // 2. Return Policy Check
  const returnFact = facts.find((f) => f.code === 'FACT-RTN-05' || f.name.toLowerCase().includes('return'));
  if (returnFact) {
    const thirtyDayMatch = text.match(/(?:30[\s-]day|thirty[\s-]day)/i);
    if (thirtyDayMatch) {
      claims.push({
        id: 'CLM-RTN-01',
        text: thirtyDayMatch[0] + ' return policy',
        category: 'policy_terms',
        status: 'outdated',
        confidence: 94,
        matchedFactId: returnFact.id,
        matchedFactName: returnFact.name,
        expectedValue: returnFact.currentValue,
        foundValue: thirtyDayMatch[0],
        sourceCitation: {
          documentName: returnFact.sourceDocName,
          passage: returnFact.sourcePassage,
          version: returnFact.version,
        },
        explanation: `Outdated return window: Return policy was modified from 30 calendar days to 14 calendar days per updated consumer terms.`,
        suggestedCorrection: '14-day return window',
      });
    }
  }

  // 3. Water Resistance Check
  const waterFact = facts.find((f) => f.code === 'FACT-WTR-02' || f.name.toLowerCase().includes('water'));
  if (waterFact) {
    if (lower.includes('100% waterproof')) {
      claims.push({
        id: 'CLM-WTR-01',
        text: '100% waterproof',
        category: 'superlative',
        status: 'contradicted',
        confidence: 99,
        matchedFactId: waterFact.id,
        matchedFactName: waterFact.name,
        expectedValue: waterFact.currentValue,
        foundValue: '100% waterproof',
        sourceCitation: {
          documentName: waterFact.sourceDocName,
          passage: waterFact.sourcePassage,
          version: waterFact.version,
        },
        explanation: `Regulatory violation & contradiction: ISO 22810:2010 classifies devices up to 50 meters (5 ATM) for swimming, not "100% waterproof". Brand Guidelines Sec 2.1 strictly forbids absolute claims.`,
        suggestedCorrection: 'water resistant up to 50 meters',
      });
    } else if (lower.includes('50 meters') || lower.includes('50m')) {
      const matchText = text.includes('50 meters') ? 'water resistant up to 50 meters' : '50m water resistance';
      claims.push({
        id: 'CLM-WTR-02',
        text: matchText,
        category: 'numeric',
        status: 'supported',
        confidence: 97,
        matchedFactId: waterFact.id,
        matchedFactName: waterFact.name,
        expectedValue: waterFact.currentValue,
        foundValue: matchText,
        sourceCitation: {
          documentName: waterFact.sourceDocName,
          passage: waterFact.sourcePassage,
          version: waterFact.version,
        },
        explanation: 'Verified: Compliant with Hardware Specification Matrix Rev 4 Section 8.3.',
        suggestedCorrection: matchText,
      });
    }
  }

  // 4. Battery Runtime Check
  const batFact = facts.find((f) => f.code === 'FACT-BAT-03' || f.name.toLowerCase().includes('battery'));
  if (batFact) {
    if (lower.includes('36 hours') || lower.includes('36h')) {
      claims.push({
        id: 'CLM-BAT-01',
        text: lower.includes('36 hours') ? 'up to 36 hours of battery life' : '36h battery power',
        category: 'numeric',
        status: 'supported',
        confidence: 98,
        matchedFactId: batFact.id,
        matchedFactName: batFact.name,
        expectedValue: batFact.currentValue,
        foundValue: '36 hours',
        sourceCitation: {
          documentName: batFact.sourceDocName,
          passage: batFact.sourcePassage,
          version: batFact.version,
        },
        explanation: 'Verified: Matches Section 11.2 battery testing runtimes.',
        suggestedCorrection: 'up to 36 hours of battery life',
      });
    }
  }

  // 5. Prohibited Superlatives Check
  if (lower.includes("world's most indestructible") || lower.includes("market's most reliable") || lower.includes("fastest acting serum in the world")) {
    const term = lower.includes("world's most indestructible")
      ? "world's most indestructible smartwatch"
      : lower.includes("market's most reliable")
      ? "market's most reliable wearable"
      : "fastest acting serum in the world";
    claims.push({
      id: 'CLM-SUP-01',
      text: term,
      category: 'superlative',
      status: 'unsupported',
      confidence: 92,
      explanation: `Unsubstantiated superlative: Brand Guidelines Section 2.1 strictly prohibits comparative absolutes without external accredited laboratory citation.`,
      suggestedCorrection: term.includes('serum') ? 'clinically tested brightening serum' : 'precision-engineered wearable',
    });
  }

  // 6. Colorway Terminology Check
  const colorFact = facts.find((f) => f.code === 'FACT-CLR-04' || f.name.toLowerCase().includes('finish') || f.name.toLowerCase().includes('color'));
  if (colorFact) {
    if (lower.includes('dark blue')) {
      claims.push({
        id: 'CLM-CLR-01',
        text: 'Dark Blue',
        category: 'brand_language',
        status: 'tone_issue',
        confidence: 95,
        matchedFactId: colorFact.id,
        matchedFactName: colorFact.name,
        expectedValue: colorFact.currentValue,
        foundValue: 'Dark Blue',
        sourceCitation: {
          documentName: colorFact.sourceDocName,
          passage: colorFact.sourcePassage,
          version: colorFact.version,
        },
        explanation: `Off-brand color terminology: Official hardware color designation is "Midnight Blue". Third-party descriptors are disallowed by Brand Guidelines Section 3.4.`,
        suggestedCorrection: 'Midnight Blue',
      });
    } else if (lower.includes('midnight blue')) {
      claims.push({
        id: 'CLM-CLR-02',
        text: 'Midnight Blue',
        category: 'brand_language',
        status: 'supported',
        confidence: 99,
        matchedFactId: colorFact.id,
        matchedFactName: colorFact.name,
        expectedValue: colorFact.currentValue,
        foundValue: 'Midnight Blue',
        sourceCitation: {
          documentName: colorFact.sourceDocName,
          passage: colorFact.sourcePassage,
          version: colorFact.version,
        },
        explanation: 'Verified: Official color taxonomy approved in Brand Guidelines.',
        suggestedCorrection: 'Midnight Blue',
      });
    }
  }

  // 7. Foxtale Vitamin C Concentration & Storage Check
  const vitcFact = facts.find((f) => f.code === 'FACT-FOX-01');
  if (vitcFact) {
    if (lower.includes('20% vitamin c') || lower.includes('20%')) {
      claims.push({
        id: 'CLM-FOX-01',
        text: '20% active Vitamin C',
        category: 'ingredient_spec',
        status: 'contradicted',
        confidence: 99,
        matchedFactId: vitcFact.id,
        matchedFactName: vitcFact.name,
        expectedValue: vitcFact.currentValue,
        foundValue: '20%',
        sourceCitation: {
          documentName: vitcFact.sourceDocName,
          passage: vitcFact.sourcePassage,
          version: vitcFact.version,
        },
        explanation: `Formula contradiction: Approved formulation is buffered at exactly 15% L-Ascorbic Acid. 20% is unapproved and risks regulatory cosmetic recall.`,
        suggestedCorrection: '15% L-Ascorbic Acid',
      });
    } else if (lower.includes('15% l-ascorbic acid') || lower.includes('15%')) {
      claims.push({
        id: 'CLM-FOX-02',
        text: '15% L-Ascorbic Acid',
        category: 'ingredient_spec',
        status: 'supported',
        confidence: 99,
        matchedFactId: vitcFact.id,
        matchedFactName: vitcFact.name,
        expectedValue: vitcFact.currentValue,
        foundValue: '15% L-Ascorbic Acid',
        sourceCitation: {
          documentName: vitcFact.sourceDocName,
          passage: vitcFact.sourcePassage,
          version: vitcFact.version,
        },
        explanation: 'Verified: Formulation & Lab Stability Report Section 3.1 confirmed.',
        suggestedCorrection: '15% L-Ascorbic Acid',
      });
    }
  }

  // 8. Foxtale PAO / Shelf Life Check
  const paoFact = facts.find((f) => f.code === 'FACT-FOX-02');
  if (paoFact) {
    if (lower.includes('2 years after opening') || lower.includes('fresh forever')) {
      claims.push({
        id: 'CLM-FOX-03',
        text: lower.includes('fresh forever') ? 'remains fresh forever' : '2 years after opening',
        category: 'policy_terms',
        status: 'contradicted',
        confidence: 98,
        matchedFactId: paoFact.id,
        matchedFactName: paoFact.name,
        expectedValue: paoFact.currentValue,
        sourceCitation: {
          documentName: paoFact.sourceDocName,
          passage: paoFact.sourcePassage,
          version: paoFact.version,
        },
        explanation: `Hazardous stability claim: PAO test reports verify efficacy only up to 6 months after opening. Marketing eternal freshness violates consumer safety standards.`,
        suggestedCorrection: 'best used within 6 months after opening',
      });
    } else if (lower.includes('6 months') || lower.includes('180 days')) {
      claims.push({
        id: 'CLM-FOX-04',
        text: 'best used within 6 months',
        category: 'policy_terms',
        status: 'supported',
        confidence: 98,
        matchedFactId: paoFact.id,
        matchedFactName: paoFact.name,
        expectedValue: paoFact.currentValue,
        sourceCitation: {
          documentName: paoFact.sourceDocName,
          passage: paoFact.sourcePassage,
          version: paoFact.version,
        },
        explanation: 'Verified: Matches certified PAO 6M packaging declaration.',
        suggestedCorrection: 'best used within 6 months',
      });
    }
  }

  // 9. Storage Condition Check
  const storageFact = facts.find((f) => f.code === 'FACT-FOX-03');
  if (storageFact) {
    if (lower.includes('direct sunlight') && !lower.includes('away from direct sunlight')) {
      claims.push({
        id: 'CLM-FOX-05',
        text: 'leave it in direct sunlight',
        category: 'policy_terms',
        status: 'contradicted',
        confidence: 97,
        matchedFactId: storageFact.id,
        matchedFactName: storageFact.name,
        expectedValue: storageFact.currentValue,
        sourceCitation: {
          documentName: storageFact.sourceDocName,
          passage: storageFact.sourcePassage,
          version: storageFact.version,
        },
        explanation: `Storage instruction contradiction: Direct UV causes instant photo-oxidation. Packaging guidelines Section 4.2 mandate "Keep in a cool, dry place away from direct sunlight and heat".`,
        suggestedCorrection: 'keep in a cool, dry place away from direct sunlight and heat',
      });
    } else if (lower.includes('cool, dry place') || lower.includes('cool, dark location')) {
      claims.push({
        id: 'CLM-FOX-06',
        text: 'keep in a cool, dry place away from direct sunlight',
        category: 'policy_terms',
        status: 'supported',
        confidence: 99,
        matchedFactId: storageFact.id,
        matchedFactName: storageFact.name,
        expectedValue: storageFact.currentValue,
        sourceCitation: {
          documentName: storageFact.sourceDocName,
          passage: storageFact.sourcePassage,
          version: storageFact.version,
        },
        explanation: 'Verified: Exact match with certified storage guidelines.',
        suggestedCorrection: 'keep in a cool, dry place away from direct sunlight and heat',
      });
    }
  }

  const stats = {
    total: claims.length,
    supported: claims.filter((c) => c.status === 'supported').length,
    contradicted: claims.filter((c) => c.status === 'contradicted').length,
    outdated: claims.filter((c) => c.status === 'outdated').length,
    unsupported: claims.filter((c) => c.status === 'unsupported').length,
    toneIssue: claims.filter((c) => c.status === 'tone_issue').length,
  };

  const penalty = stats.contradicted * 35 + stats.outdated * 30 + stats.unsupported * 20 + stats.toneIssue * 10;
  const overallScore = Math.max(0, Math.min(100, Math.round(100 - (stats.total > 0 ? (penalty / (stats.total * 30)) * 100 : 0))));

  return { claims, overallScore, stats };
}

export function runChangeImpactSimulation(
  factId: string,
  newFactValue: string,
  facts: Fact[],
  assets: ContentAsset[]
): ChangeImpactResult {
  const targetFact = facts.find((f) => f.id === factId) || facts[0];
  const oldVal = targetFact.currentValue;

  const affectedAssets: ChangeImpactResult['affectedAssets'] = [];
  const unaffectedAssets: ChangeImpactResult['unaffectedAssets'] = [];

  assets.forEach((asset) => {
    const isDirectlyLinked = asset.linkedFactIds.includes(targetFact.id);
    const contentLower = asset.content.toLowerCase();

    // Check if the asset actually mentions the changing attribute
    let isAffected = false;
    const affectedClaims: { claimText: string; reason: string; suggestedFix: string }[] = [];

    if (targetFact.code === 'FACT-WTY-01' || targetFact.name.toLowerCase().includes('warranty')) {
      if (contentLower.includes('2-year') || contentLower.includes('two-year') || contentLower.includes('two years')) {
        isAffected = true;
        affectedClaims.push({
          claimText: '2-year warranty / two years of coverage',
          reason: `Asset contains reference to superseded warranty terms (${oldVal}) which no longer matches approved standard (${newFactValue}).`,
          suggestedFix: '1-year limited manufacturer warranty',
        });
      }
    } else if (targetFact.code === 'FACT-RTN-05' || targetFact.name.toLowerCase().includes('return')) {
      if (contentLower.includes('30-day') || contentLower.includes('30 calendar days')) {
        isAffected = true;
        affectedClaims.push({
          claimText: '30-day return policy',
          reason: `Return window shortened to 14 days per updated consumer terms.`,
          suggestedFix: '14 calendar days from delivery date',
        });
      }
    } else if (targetFact.code === 'FACT-FOX-01') {
      if (contentLower.includes('15%') && !newFactValue.includes('15%')) {
        isAffected = true;
        affectedClaims.push({
          claimText: '15% L-Ascorbic Acid concentration',
          reason: `Formula active percentage updated from ${oldVal} to ${newFactValue}.`,
          suggestedFix: newFactValue,
        });
      }
    }

    if (isAffected) {
      affectedAssets.push({
        assetId: asset.id,
        assetTitle: asset.title,
        assetType: asset.type,
        affectedClaims,
        impactSeverity: 'high',
      });
    } else {
      unaffectedAssets.push({
        assetId: asset.id,
        assetTitle: asset.title,
        checkedReason: isDirectlyLinked
          ? 'Checked for dependent claims: No conflicting clauses found in active copy.'
          : 'Does not reference or depend on this specific attribute.',
      });
    }
  });

  return {
    factId: targetFact.id,
    factName: targetFact.name,
    oldValue: oldVal,
    newValue: newFactValue,
    timestamp: new Date().toISOString(),
    totalAssetsScanned: assets.length,
    affectedAssets,
    unaffectedAssets,
  };
}
