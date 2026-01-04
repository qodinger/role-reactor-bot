/**
 * Chat Prompts Configuration Tests
 * Tests for chat prompt structure, content, and integration
 */

import { describe, it, expect } from 'vitest';
import {
  CHAT_PROMPTS,
  criticalRules,
  generalGuidelinesBase,
  capabilitiesBase,
  commandExecutionRestriction,
  followUpTemplate,
} from '../../../../src/config/prompts/chat/index.js';

describe('Chat Prompts Configuration', () => {
  describe('Individual Prompt Exports', () => {
    it('should export criticalRules as a non-empty string', () => {
      expect(criticalRules).toBeDefined();
      expect(typeof criticalRules).toBe('string');
      expect(criticalRules.length).toBeGreaterThan(0);
      expect(criticalRules.trim()).not.toBe('');
    });

    it('should export generalGuidelinesBase as a non-empty string', () => {
      expect(generalGuidelinesBase).toBeDefined();
      expect(typeof generalGuidelinesBase).toBe('string');
      expect(generalGuidelinesBase.length).toBeGreaterThan(0);
      expect(generalGuidelinesBase.trim()).not.toBe('');
    });

    it('should export capabilitiesBase as a non-empty string', () => {
      expect(capabilitiesBase).toBeDefined();
      expect(typeof capabilitiesBase).toBe('string');
      expect(capabilitiesBase.length).toBeGreaterThan(0);
      expect(capabilitiesBase.trim()).not.toBe('');
    });

    it('should export commandExecutionRestriction as a non-empty string', () => {
      expect(commandExecutionRestriction).toBeDefined();
      expect(typeof commandExecutionRestriction).toBe('string');
      expect(commandExecutionRestriction.length).toBeGreaterThan(0);
      expect(commandExecutionRestriction.trim()).not.toBe('');
    });

    it('should export followUpTemplate as a non-empty string', () => {
      expect(followUpTemplate).toBeDefined();
      expect(typeof followUpTemplate).toBe('string');
      expect(followUpTemplate.length).toBeGreaterThan(0);
      expect(followUpTemplate.trim()).not.toBe('');
    });
  });

  describe('CHAT_PROMPTS Combined Object', () => {
    it('should export CHAT_PROMPTS as an object', () => {
      expect(CHAT_PROMPTS).toBeDefined();
      expect(typeof CHAT_PROMPTS).toBe('object');
      expect(CHAT_PROMPTS).not.toBeNull();
    });

    it('should contain all expected prompt properties', () => {
      const expectedProperties = [
        'criticalRules',
        'generalGuidelinesBase',
        'capabilitiesBase',
        'commandExecutionRestriction',
        'followUpTemplate',
      ];

      expectedProperties.forEach(prop => {
        expect(CHAT_PROMPTS).toHaveProperty(prop);
        expect(typeof CHAT_PROMPTS[prop]).toBe('string');
        expect(CHAT_PROMPTS[prop].length).toBeGreaterThan(0);
      });
    });

    it('should have consistent references between individual exports and combined object', () => {
      expect(CHAT_PROMPTS.criticalRules).toBe(criticalRules);
      expect(CHAT_PROMPTS.generalGuidelinesBase).toBe(generalGuidelinesBase);
      expect(CHAT_PROMPTS.capabilitiesBase).toBe(capabilitiesBase);
      expect(CHAT_PROMPTS.commandExecutionRestriction).toBe(commandExecutionRestriction);
      expect(CHAT_PROMPTS.followUpTemplate).toBe(followUpTemplate);
    });
  });

  describe('Critical Rules Content', () => {
    it('should contain essential command usage rules', () => {
      expect(criticalRules).toContain('Command Usage Rules');
      expect(criticalRules).toContain('JSON format');
      expect(criticalRules).toContain('plain text/markdown format');
    });

    it('should contain data understanding guidelines', () => {
      expect(criticalRules).toContain('Data Understanding');
      expect(criticalRules).toContain('Members vs Bots');
      expect(criticalRules).toContain('guide users to Discord');
    });

    it('should contain security guidelines', () => {
      expect(criticalRules).toContain('Security');
      expect(criticalRules).toContain('API keys');
      expect(criticalRules).toContain('sensitive configuration');
    });

    it('should contain status meanings', () => {
      expect(criticalRules).toContain('🟢 online');
      expect(criticalRules).toContain('🟡 idle');
      expect(criticalRules).toContain('🔴 dnd');
      expect(criticalRules).toContain('⚫ offline');
    });
  });

  describe('General Guidelines Content', () => {
    it('should contain bot identity guidelines', () => {
      expect(generalGuidelinesBase).toContain('You ARE the bot');
      expect(generalGuidelinesBase).toContain('Role Reactor');
      expect(generalGuidelinesBase).toContain('not an AI assistant');
    });

    it('should contain conversation context guidelines', () => {
      expect(generalGuidelinesBase).toContain('Conversation Context');
      expect(generalGuidelinesBase).toContain('greetings');
      expect(generalGuidelinesBase).toContain('start fresh');
    });

    it('should contain response style guidelines', () => {
      expect(generalGuidelinesBase).toContain('Response Style');
      expect(generalGuidelinesBase).toContain('brief by default');
      expect(generalGuidelinesBase).toContain('Discord bot');
    });

    it('should contain good and bad response examples', () => {
      expect(generalGuidelinesBase).toContain('GOOD response');
      expect(generalGuidelinesBase).toContain('BAD response');
      expect(generalGuidelinesBase).toContain('DO NOT DO THIS');
    });
  });

  describe('Capabilities Content', () => {
    it('should contain command execution capabilities', () => {
      expect(capabilitiesBase).toContain('Execute General Commands');
      expect(capabilitiesBase).toContain('/src/commands/general');
    });

    it('should contain command usage instructions', () => {
      expect(capabilitiesBase).toContain('execute_command');
      expect(capabilitiesBase).toContain('REQUIRED');
      expect(capabilitiesBase).toContain('ALL required options');
    });

    it('should contain RPS-specific instructions', () => {
      expect(capabilitiesBase).toContain('RPS');
      expect(capabilitiesBase).toContain('rock, paper, or scissors');
      expect(capabilitiesBase).toContain('RANDOMIZATION');
    });

    it('should contain image generation instructions', () => {
      expect(capabilitiesBase).toContain('Image/Avatar Generation');
      expect(capabilitiesBase).toContain('avatar, imagine');
      expect(capabilitiesBase).toContain('EXACT description');
    });
  });

  describe('Command Execution Restriction Content', () => {
    it('should contain execution restrictions', () => {
      expect(commandExecutionRestriction).toContain('ONLY EXECUTE commands');
      expect(commandExecutionRestriction).toContain('"general" category');
      expect(commandExecutionRestriction).toContain('Admin commands CANNOT be executed');
      expect(commandExecutionRestriction).toContain('Developer commands CANNOT be executed');
    });

    it('should contain information provision guidelines', () => {
      expect(commandExecutionRestriction).toContain('Providing Information About Commands');
      expect(commandExecutionRestriction).toContain('CAN provide information');
      expect(commandExecutionRestriction).toContain('CANNOT execute admin/developer commands');
    });
  });

  describe('Follow-up Template Content', () => {
    it('should contain helpful guidance for user interactions', () => {
      expect(followUpTemplate).toContain('attempted');
      expect(followUpTemplate).toContain('action results');
    });

    it('should contain error handling instructions', () => {
      expect(followUpTemplate).toContain('If errors occurred');
      expect(followUpTemplate).toContain('inform the user about the errors');
      expect(followUpTemplate).toContain('what went wrong');
    });

    it('should contain formatting guidelines', () => {
      expect(followUpTemplate).toContain('EXACT names');
      expect(followUpTemplate).toContain('Do NOT invent');
      expect(followUpTemplate).toContain('Do NOT use generic names');
    });

    it('should warn against fake names', () => {
      expect(followUpTemplate).toContain('iFunny');
      expect(followUpTemplate).toContain('Reddit');
      expect(followUpTemplate).toContain('John');
      expect(followUpTemplate).toContain('Alice');
    });
  });

  describe('Prompt Structure and Quality', () => {
    it('should have reasonable length prompts (not too short or too long)', () => {
      // Critical rules should be comprehensive but not excessive
      expect(criticalRules.length).toBeGreaterThan(500);
      expect(criticalRules.length).toBeLessThan(5000);

      // Guidelines should be detailed but manageable
      expect(generalGuidelinesBase.length).toBeGreaterThan(300);
      expect(generalGuidelinesBase.length).toBeLessThan(3000);

      // Capabilities should be thorough
      expect(capabilitiesBase.length).toBeGreaterThan(800);
      expect(capabilitiesBase.length).toBeLessThan(4000);
    });

    it('should not contain placeholder text', () => {
      const allPrompts = [
        criticalRules,
        generalGuidelinesBase,
        capabilitiesBase,
        commandExecutionRestriction,
        followUpTemplate,
      ];

      allPrompts.forEach(prompt => {
        expect(prompt).not.toContain('TODO');
        expect(prompt).not.toContain('FIXME');
        expect(prompt).not.toContain('placeholder');
        expect(prompt).not.toContain('{{');
        expect(prompt).not.toContain('}}');
      });
    });

    it('should use consistent formatting', () => {
      const allPrompts = [
        criticalRules,
        generalGuidelinesBase,
        capabilitiesBase,
        commandExecutionRestriction,
        followUpTemplate,
      ];

      allPrompts.forEach(prompt => {
        // Should not have excessive whitespace
        expect(prompt).not.toMatch(/\n\n\n\n/);
        // Should not start or end with whitespace
        expect(prompt.trim()).toBe(prompt);
      });
    });

    it('should contain proper markdown formatting', () => {
      const allPrompts = [
        criticalRules,
        generalGuidelinesBase,
        capabilitiesBase,
        commandExecutionRestriction,
        followUpTemplate,
      ];

      allPrompts.forEach(prompt => {
        // Should contain proper headers
        if (prompt.includes('#')) {
          expect(prompt).toMatch(/^##?\s+/m);
        }
        // Should contain proper bold formatting
        if (prompt.includes('**')) {
          expect(prompt).toMatch(/\*\*[^*]+\*\*/);
        }
      });
    });
  });

  describe('Integration and Consistency', () => {
    it('should have consistent terminology across prompts', () => {
      const allPrompts = Object.values(CHAT_PROMPTS).join(' ');
      
      // Should consistently refer to the bot
      expect(allPrompts).toContain('Role Reactor');
      expect(allPrompts).toContain('Discord bot');
      
      // Should consistently use command terminology
      expect(allPrompts).toContain('execute_command');
      expect(allPrompts).toContain('JSON format');
      expect(allPrompts).toContain('plain text');
    });

    it('should not have conflicting instructions', () => {
      const allPrompts = Object.values(CHAT_PROMPTS).join(' ');
      
      // Should consistently refer to the bot
      expect(allPrompts).toContain('Role Reactor');
      expect(allPrompts).toContain('Discord bot');
      
      // Should consistently use command terminology
      expect(allPrompts).toContain('execute_command');
      expect(allPrompts).toContain('JSON format');
      expect(allPrompts).toContain('plain text');
      
      // Should emphasize bot identity over AI identity
      const botIdentity = allPrompts.match(/You ARE.*bot|Discord bot/gi) || [];
      expect(botIdentity.length).toBeGreaterThan(0);
      
      // Should discourage AI assistant language
      expect(allPrompts).toContain('DO NOT DO THIS');
    });
  });

  describe('Prompt Loading and Usage', () => {
    it('should be importable by the system prompt builder', async () => {
      // Test that the prompts can be imported by the actual system
      const { CHAT_PROMPTS: importedPrompts } = await import('../../../../src/config/prompts/chat/index.js');
      
      expect(importedPrompts).toBeDefined();
      expect(importedPrompts).toEqual(CHAT_PROMPTS);
    });

    it('should be compatible with the systemPromptBuilder usage', () => {
      // Test that the prompts have the expected structure for systemPromptBuilder
      expect(CHAT_PROMPTS.criticalRules).toBeDefined();
      expect(CHAT_PROMPTS.commandExecutionRestriction).toBeDefined();
      expect(CHAT_PROMPTS.capabilitiesBase).toBeDefined();
      expect(CHAT_PROMPTS.generalGuidelinesBase).toBeDefined();
      
      // These are the properties used in systemPromptBuilder.js
      const requiredForBuilder = [
        'criticalRules',
        'commandExecutionRestriction',
        'capabilitiesBase',
        'generalGuidelinesBase',
      ];
      
      requiredForBuilder.forEach(prop => {
        expect(CHAT_PROMPTS).toHaveProperty(prop);
        expect(typeof CHAT_PROMPTS[prop]).toBe('string');
      });
    });
  });
});