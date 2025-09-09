#!/usr/bin/env node

/**
 * Planning Structure Validation Script
 * 
 * Validates that the planning system structure follows all conventions
 * and that all required files are properly formatted.
 */

const fs = require('fs');
const path = require('path');

class PlanningValidator {
    constructor() {
        this.basePath = '/workspace/planning';
        this.taskPath = '/workspace/planning/tasks/validate-planning-structure';
        this.errors = [];
        this.warnings = [];
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = type === 'error' ? '❌' : type === 'warning' ? '⚠️' : '✅';
        console.log(`${prefix} [${timestamp}] ${message}`);
    }

    error(message) {
        this.errors.push(message);
        this.log(message, 'error');
    }

    warning(message) {
        this.warnings.push(message);
        this.log(message, 'warning');
    }

    success(message) {
        this.log(message, 'success');
    }

    // Validation Methods

    validateDirectoryStructure() {
        this.log('Validating directory structure...');
        
        // Check main task directory exists
        if (!fs.existsSync(this.taskPath)) {
            this.error('Main task directory does not exist');
            return false;
        }
        this.success('Main task directory exists');

        // Check subtask directory exists
        const subtaskPath = path.join(this.taskPath, 'verify-structure');
        if (!fs.existsSync(subtaskPath)) {
            this.error('Subtask directory does not exist');
            return false;
        }
        this.success('Subtask directory exists');

        return true;
    }

    validateReadmeFormat() {
        this.log('Validating README.md format...');
        
        const readmePath = path.join(this.taskPath, 'README.md');
        if (!fs.existsSync(readmePath)) {
            this.error('Main README.md does not exist');
            return false;
        }

        const content = fs.readFileSync(readmePath, 'utf8');
        const requiredSections = [
            '# Task:',
            '## Status',
            '## Description',
            '## Requirements',
            '## Acceptance Criteria',
            '## Implementation Steps'
        ];

        let allSectionsPresent = true;
        for (const section of requiredSections) {
            if (!content.includes(section)) {
                this.error(`Missing required section: ${section}`);
                allSectionsPresent = false;
            } else {
                this.success(`Found required section: ${section}`);
            }
        }

        return allSectionsPresent;
    }

    validatePlanYamlFormat() {
        this.log('Validating plan.yaml format...');
        
        const planPath = path.join(this.taskPath, 'plan.yaml');
        if (!fs.existsSync(planPath)) {
            this.error('plan.yaml does not exist');
            return false;
        }

        const content = fs.readFileSync(planPath, 'utf8');
        const requiredFields = [
            'task:',
            'priority:',
            'estimated_effort:',
            'dependencies:',
            'analysis:',
            'implementation_steps:',
            'testing_strategy:',
            'completion_criteria:'
        ];

        let allFieldsPresent = true;
        for (const field of requiredFields) {
            if (!content.includes(field)) {
                this.error(`Missing required field in plan.yaml: ${field}`);
                allFieldsPresent = false;
            } else {
                this.success(`Found required field: ${field}`);
            }
        }

        return allFieldsPresent;
    }

    validateSubtaskStructure() {
        this.log('Validating subtask structure...');
        
        const subtaskReadmePath = path.join(this.taskPath, 'verify-structure', 'README.md');
        if (!fs.existsSync(subtaskReadmePath)) {
            this.error('Subtask README.md does not exist');
            return false;
        }

        const content = fs.readFileSync(subtaskReadmePath, 'utf8');
        
        // Check for parent reference
        if (!content.includes('Parent:')) {
            this.error('Subtask README.md missing parent reference');
            return false;
        }
        this.success('Subtask has parent reference');

        // Check hierarchical path structure
        if (!content.includes('../')) {
            this.warning('Subtask may not properly reference parent files');
        } else {
            this.success('Subtask references parent files correctly');
        }

        return true;
    }

    validateIndexIntegration() {
        this.log('Validating planning INDEX.md integration...');
        
        const indexPath = path.join(this.basePath, 'INDEX.md');
        if (!fs.existsSync(indexPath)) {
            this.error('planning/INDEX.md does not exist');
            return false;
        }

        const content = fs.readFileSync(indexPath, 'utf8');
        
        // Check if task is listed in index
        if (!content.includes('validate-planning-structure')) {
            this.error('Task not found in planning INDEX.md');
            return false;
        }
        this.success('Task found in planning INDEX.md');

        // Check if it's in the right priority section
        if (!content.includes('Medium Priority') || !content.includes('validate-planning-structure')) {
            this.warning('Task may not be in correct priority section');
        } else {
            this.success('Task appears to be in correct priority section');
        }

        return true;
    }

    validateNamingConventions() {
        this.log('Validating naming conventions...');
        
        // Check directory name follows kebab-case
        const taskDirName = path.basename(this.taskPath);
        if (!/^[a-z][a-z0-9-]*[a-z0-9]$/.test(taskDirName)) {
            this.error(`Task directory name "${taskDirName}" does not follow kebab-case convention`);
            return false;
        }
        this.success('Task directory follows kebab-case naming');

        // Check subtask name
        const subtaskDirName = 'verify-structure';
        if (!/^[a-z][a-z0-9-]*[a-z0-9]$/.test(subtaskDirName)) {
            this.error(`Subtask directory name "${subtaskDirName}" does not follow kebab-case convention`);
            return false;
        }
        this.success('Subtask directory follows kebab-case naming');

        return true;
    }

    // Main validation runner
    runValidation() {
        console.log('🚀 Starting Planning Structure Validation\n');
        
        const validators = [
            () => this.validateDirectoryStructure(),
            () => this.validateReadmeFormat(),
            () => this.validatePlanYamlFormat(),
            () => this.validateSubtaskStructure(),
            () => this.validateIndexIntegration(),
            () => this.validateNamingConventions()
        ];

        let allPassed = true;
        for (const validator of validators) {
            try {
                const result = validator();
                if (!result) allPassed = false;
            } catch (error) {
                this.error(`Validation failed with error: ${error.message}`);
                allPassed = false;
            }
            console.log(''); // Add spacing between validation sections
        }

        // Summary
        console.log('📊 VALIDATION SUMMARY');
        console.log('='.repeat(50));
        console.log(`✅ Validations passed: ${validators.length - this.errors.length}`);
        console.log(`❌ Errors: ${this.errors.length}`);
        console.log(`⚠️  Warnings: ${this.warnings.length}`);
        
        if (this.errors.length > 0) {
            console.log('\n❌ ERRORS:');
            this.errors.forEach(error => console.log(`  - ${error}`));
        }
        
        if (this.warnings.length > 0) {
            console.log('\n⚠️  WARNINGS:');
            this.warnings.forEach(warning => console.log(`  - ${warning}`));
        }

        if (allPassed) {
            console.log('\n🎉 All validations passed! Planning structure is correct.');
        } else {
            console.log('\n💥 Some validations failed. Please review and fix the issues above.');
        }

        return allPassed;
    }
}

// Run validation if called directly
if (require.main === module) {
    const validator = new PlanningValidator();
    const success = validator.runValidation();
    process.exit(success ? 0 : 1);
}

module.exports = PlanningValidator;