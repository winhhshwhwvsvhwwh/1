// components/RiskWarningCard/RiskWarningCard.js
Component({
  methods: {
    onContinue() {
      this.triggerEvent('continue');
    },
    onDoctor() {
      this.triggerEvent('doctor');
    }
  }
});
